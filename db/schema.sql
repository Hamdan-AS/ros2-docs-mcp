-- ROS2-Docs MCP — minimal schema (Phase 3)
-- Tables per roadmap:
--   packages   (id, name, distro, source_url)
--   doc_chunks (id, package_id, distro, section_title, content, source_url, last_scraped_at)

CREATE TABLE IF NOT EXISTS packages (
    id         SERIAL PRIMARY KEY,
    name       TEXT NOT NULL,
    distro     TEXT NOT NULL,
    source_url TEXT NOT NULL,
    UNIQUE (name, distro)
);

CREATE TABLE IF NOT EXISTS doc_chunks (
    id             SERIAL PRIMARY KEY,
    package_id     INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    distro         TEXT NOT NULL,
    section_title  TEXT NOT NULL,
    content        TEXT NOT NULL,
    source_url     TEXT NOT NULL,
    last_scraped_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Full-text search index (Phase 4): English config on content + section_title.
CREATE INDEX IF NOT EXISTS idx_doc_chunks_fts
    ON doc_chunks USING GIN (
        to_tsvector('english', section_title || ' ' || content)
    );

-- Phase 7: accounts + API keys (per-user rate limiting, Phase 8B billing hook).
CREATE TABLE IF NOT EXISTS users (
    id         SERIAL PRIMARY KEY,
    name       TEXT NOT NULL,
    tier       TEXT NOT NULL DEFAULT 'free',
    credit_limit INTEGER CHECK (credit_limit IS NULL OR credit_limit > 0),
    email_normalized TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_unique
    ON users (email_normalized) WHERE email_normalized IS NOT NULL;

CREATE TABLE IF NOT EXISTS api_keys (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash     TEXT NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_one_active_per_user ON api_keys (user_id);

-- Historical UTC-day request counts retained for 90-day operational reporting.
CREATE TABLE IF NOT EXISTS api_daily_usage (
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date    DATE NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
    PRIMARY KEY (user_id, usage_date)
);

-- Current credit/cooldown state. Rows are created lazily on the first request.
CREATE TABLE IF NOT EXISTS api_quota_state (
    user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    credits_used   INTEGER NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
    cooldown_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS api_signup_verifications (
    email_normalized TEXT PRIMARY KEY,
    otp_hash TEXT,
    otp_expires_at TIMESTAMPTZ,
    failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
    banned_until TIMESTAMPTZ,
    send_window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    send_count INTEGER NOT NULL DEFAULT 0 CHECK (send_count >= 0),
    last_sent_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
