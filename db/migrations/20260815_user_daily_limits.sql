-- Optional per-user override keeps quota testing isolated from real customers.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS daily_limit INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'users_daily_limit_positive'
           AND conrelid = 'users'::regclass
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_daily_limit_positive
            CHECK (daily_limit IS NULL OR daily_limit > 0);
    END IF;
END
$$;
