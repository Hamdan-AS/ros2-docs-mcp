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
    daily_limit INTEGER CHECK (daily_limit IS NULL OR daily_limit > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash     TEXT NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

-- Shared, atomic per-user daily quotas for stateless Worker instances.
CREATE TABLE IF NOT EXISTS api_daily_usage (
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date    DATE NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
    PRIMARY KEY (user_id, usage_date)
);
