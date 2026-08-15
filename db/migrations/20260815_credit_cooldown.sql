-- Replace UTC-day buckets with a persistent credit balance. A user's 48-hour
-- cooldown begins only when the final available credit is consumed.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'daily_limit'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'credit_limit'
    ) THEN
        ALTER TABLE users RENAME COLUMN daily_limit TO credit_limit;
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'daily_limit'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'credit_limit'
    ) THEN
        UPDATE users SET credit_limit = COALESCE(credit_limit, daily_limit);
        ALTER TABLE users DROP COLUMN daily_limit;
    END IF;
END $$;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS credit_limit INTEGER;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_daily_limit_positive;
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_credit_limit_positive;
ALTER TABLE users
    ADD CONSTRAINT users_credit_limit_positive
    CHECK (credit_limit IS NULL OR credit_limit > 0);

CREATE TABLE IF NOT EXISTS api_quota_state (
    user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    credits_used   INTEGER NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
    cooldown_until TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION consume_api_credit(p_user_id INTEGER, p_credit_limit INTEGER)
RETURNS TABLE (allowed BOOLEAN, credits_used INTEGER, cooldown_until TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
DECLARE
    quota api_quota_state%ROWTYPE;
    checked_at TIMESTAMPTZ := now();
BEGIN
    IF p_credit_limit <= 0 THEN
        RAISE EXCEPTION 'credit limit must be positive';
    END IF;

    INSERT INTO api_quota_state (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT state.* INTO quota
      FROM api_quota_state AS state
     WHERE state.user_id = p_user_id
     FOR UPDATE;

    IF quota.cooldown_until IS NOT NULL AND quota.cooldown_until > checked_at THEN
        RETURN QUERY SELECT FALSE, quota.credits_used, quota.cooldown_until;
        RETURN;
    END IF;

    -- An expired cooldown starts a fresh cycle. The current request is credit 1.
    IF quota.cooldown_until IS NOT NULL THEN
        quota.credits_used := 0;
        quota.cooldown_until := NULL;
    END IF;

    -- This can occur if an operator lowers a user's limit mid-cycle.
    IF quota.credits_used >= p_credit_limit THEN
        quota.cooldown_until := checked_at + INTERVAL '48 hours';
        UPDATE api_quota_state AS state
           SET cooldown_until = quota.cooldown_until
         WHERE state.user_id = p_user_id;
        RETURN QUERY SELECT FALSE, quota.credits_used, quota.cooldown_until;
        RETURN;
    END IF;

    quota.credits_used := quota.credits_used + 1;
    IF quota.credits_used = p_credit_limit THEN
        quota.cooldown_until := checked_at + INTERVAL '48 hours';
    END IF;

    UPDATE api_quota_state AS state
       SET credits_used = quota.credits_used,
           cooldown_until = quota.cooldown_until
     WHERE state.user_id = p_user_id;

    RETURN QUERY SELECT TRUE, quota.credits_used, quota.cooldown_until;
END;
$$;
