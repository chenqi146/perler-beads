CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS patterns (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', tags_json TEXT NOT NULL DEFAULT '[]', visibility TEXT NOT NULL DEFAULT 'private', data_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS craft_sessions (id TEXT PRIMARY KEY, pattern_id TEXT NOT NULL, owner_id TEXT NOT NULL, snapshot_json TEXT NOT NULL, completed_cells_json TEXT NOT NULL DEFAULT '[]', elapsed_seconds INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS works (id TEXT PRIMARY KEY, pattern_id TEXT NOT NULL, craft_session_id TEXT NOT NULL, owner_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', tags_json TEXT NOT NULL DEFAULT '[]', image_key TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'private', created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS patterns_owner_idx ON patterns(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS patterns_public_idx ON patterns(visibility, updated_at DESC);
CREATE INDEX IF NOT EXISTS works_public_idx ON works(visibility, created_at DESC);
