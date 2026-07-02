CREATE TABLE IF NOT EXISTS oauth_states (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS oauth_sessions (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS oauth_locks (
  name TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_sessions (
  id TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS profiles (
  did TEXT PRIMARY KEY,
  handle TEXT,
  display_name TEXT,
  avatar_url TEXT,
  headline TEXT,
  location TEXT,
  availability TEXT,
  skills TEXT NOT NULL DEFAULT '[]',
  website TEXT,
  bio TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at
  ON oauth_states (expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_locks_expires_at
  ON oauth_locks (expires_at);

CREATE INDEX IF NOT EXISTS idx_app_sessions_did
  ON app_sessions (did);

CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at
  ON app_sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_profiles_handle
  ON profiles (handle);
