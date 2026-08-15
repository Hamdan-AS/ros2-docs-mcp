-- Idempotent migration for Cloudflare Worker request quotas.
CREATE TABLE IF NOT EXISTS api_daily_usage (
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date    DATE NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
    PRIMARY KEY (user_id, usage_date)
);
