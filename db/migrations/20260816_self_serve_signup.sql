-- Self-serve bearer-key signup. Raw OTPs and API keys never enter Postgres.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_normalized TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_unique
    ON users (email_normalized)
    WHERE email_normalized IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_one_active_per_user
    ON api_keys (user_id);

CREATE TABLE IF NOT EXISTS api_signup_verifications (
    email_normalized  TEXT PRIMARY KEY,
    otp_hash          TEXT,
    otp_expires_at    TIMESTAMPTZ,
    failed_attempts   INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
    banned_until      TIMESTAMPTZ,
    send_window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    send_count        INTEGER NOT NULL DEFAULT 0 CHECK (send_count >= 0),
    last_sent_at      TIMESTAMPTZ,
    verified_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_signup_verifications_expiry_idx
    ON api_signup_verifications (otp_expires_at);

CREATE OR REPLACE FUNCTION begin_api_signup(p_email TEXT, p_otp_hash TEXT)
RETURNS TABLE (should_send BOOLEAN)
LANGUAGE plpgsql
AS $$
DECLARE
    signup api_signup_verifications%ROWTYPE;
    checked_at TIMESTAMPTZ := now();
BEGIN
    INSERT INTO api_signup_verifications (email_normalized)
    VALUES (p_email)
    ON CONFLICT (email_normalized) DO NOTHING;

    SELECT record.* INTO signup
      FROM api_signup_verifications AS record
     WHERE record.email_normalized = p_email
     FOR UPDATE;

    IF EXISTS (
        SELECT 1
          FROM users u
          JOIN api_keys k ON k.user_id = u.id
         WHERE u.email_normalized = p_email
    ) THEN
        RETURN QUERY SELECT FALSE;
        RETURN;
    END IF;

    IF signup.banned_until IS NOT NULL AND signup.banned_until > checked_at THEN
        RETURN QUERY SELECT FALSE;
        RETURN;
    END IF;

    IF signup.banned_until IS NOT NULL AND signup.banned_until <= checked_at THEN
        signup.failed_attempts := 0;
    END IF;

    IF signup.send_window_start <= checked_at - INTERVAL '2 hours' THEN
        signup.send_window_start := checked_at;
        signup.send_count := 0;
        signup.failed_attempts := 0;
    END IF;

    IF signup.last_sent_at IS NOT NULL
       AND signup.last_sent_at > checked_at - INTERVAL '60 seconds' THEN
        RETURN QUERY SELECT FALSE;
        RETURN;
    END IF;

    IF signup.send_count >= 3 THEN
        RETURN QUERY SELECT FALSE;
        RETURN;
    END IF;

    UPDATE api_signup_verifications AS record
       SET otp_hash = p_otp_hash,
           otp_expires_at = checked_at + INTERVAL '10 minutes',
           failed_attempts = signup.failed_attempts,
           banned_until = NULL,
           send_window_start = signup.send_window_start,
           send_count = signup.send_count + 1,
           last_sent_at = checked_at,
           verified_at = NULL,
           updated_at = checked_at
     WHERE record.email_normalized = p_email;

    RETURN QUERY SELECT TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION cancel_api_signup(p_email TEXT, p_otp_hash TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE api_signup_verifications
       SET otp_hash = NULL,
           otp_expires_at = NULL,
           send_count = GREATEST(send_count - 1, 0),
           last_sent_at = NULL,
           updated_at = now()
     WHERE email_normalized = p_email
       AND otp_hash = p_otp_hash
       AND verified_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION verify_api_signup(p_email TEXT, p_otp_hash TEXT, p_key_hash TEXT)
RETURNS TABLE (status TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    signup api_signup_verifications%ROWTYPE;
    target_user_id INTEGER;
    checked_at TIMESTAMPTZ := now();
BEGIN
    SELECT record.* INTO signup
      FROM api_signup_verifications AS record
     WHERE record.email_normalized = p_email
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'invalid'::TEXT;
        RETURN;
    END IF;

    SELECT u.id INTO target_user_id
      FROM users u
     WHERE u.email_normalized = p_email;

    IF target_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM api_keys k WHERE k.user_id = target_user_id
    ) THEN
        RETURN QUERY SELECT 'already_active'::TEXT;
        RETURN;
    END IF;

    IF (signup.banned_until IS NOT NULL AND signup.banned_until > checked_at)
       OR signup.otp_hash IS NULL
       OR signup.otp_expires_at IS NULL
       OR signup.otp_expires_at <= checked_at THEN
        RETURN QUERY SELECT 'invalid'::TEXT;
        RETURN;
    END IF;

    IF signup.otp_hash <> p_otp_hash THEN
        signup.failed_attempts := signup.failed_attempts + 1;
        UPDATE api_signup_verifications AS record
           SET failed_attempts = signup.failed_attempts,
               banned_until = CASE WHEN signup.failed_attempts >= 3
                                   THEN checked_at + INTERVAL '2 hours'
                                   ELSE record.banned_until END,
               otp_hash = CASE WHEN signup.failed_attempts >= 3 THEN NULL ELSE record.otp_hash END,
               otp_expires_at = CASE WHEN signup.failed_attempts >= 3 THEN NULL ELSE record.otp_expires_at END,
               updated_at = checked_at
         WHERE record.email_normalized = p_email;
        RETURN QUERY SELECT 'invalid'::TEXT;
        RETURN;
    END IF;

    IF target_user_id IS NULL THEN
        INSERT INTO users (name, email_normalized, tier)
        VALUES (p_email, p_email, 'free')
        ON CONFLICT DO NOTHING
        RETURNING id INTO target_user_id;
        IF target_user_id IS NULL THEN
            SELECT u.id INTO target_user_id FROM users u WHERE u.email_normalized = p_email;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM api_keys k WHERE k.user_id = target_user_id) THEN
        RETURN QUERY SELECT 'already_active'::TEXT;
        RETURN;
    END IF;

    INSERT INTO api_keys (user_id, key_hash) VALUES (target_user_id, p_key_hash);
    INSERT INTO api_quota_state (user_id) VALUES (target_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE api_signup_verifications AS record
       SET otp_hash = NULL,
           otp_expires_at = NULL,
           failed_attempts = 0,
           banned_until = NULL,
           verified_at = checked_at,
           updated_at = checked_at
     WHERE record.email_normalized = p_email;

    RETURN QUERY SELECT 'issued'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION rollback_api_key_delivery(
    p_email TEXT,
    p_key_hash TEXT,
    p_otp_hash TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    target_user_id INTEGER;
BEGIN
    SELECT id INTO target_user_id FROM users WHERE email_normalized = p_email;
    IF target_user_id IS NULL THEN RETURN; END IF;

    DELETE FROM api_keys WHERE user_id = target_user_id AND key_hash = p_key_hash;
    IF FOUND THEN
        DELETE FROM api_quota_state
         WHERE user_id = target_user_id
           AND NOT EXISTS (SELECT 1 FROM api_keys WHERE user_id = target_user_id);
        UPDATE api_signup_verifications
           SET otp_hash = p_otp_hash,
               otp_expires_at = now() + INTERVAL '10 minutes',
               failed_attempts = 0,
               verified_at = NULL,
               updated_at = now()
         WHERE email_normalized = p_email;
    END IF;
END;
$$;
