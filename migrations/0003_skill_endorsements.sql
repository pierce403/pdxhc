CREATE TABLE IF NOT EXISTS skill_endorsements (
  id TEXT PRIMARY KEY,
  profile_did TEXT NOT NULL,
  skill TEXT NOT NULL,
  skill_key TEXT NOT NULL,
  endorser_did TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(profile_did, skill_key, endorser_did)
);

CREATE INDEX IF NOT EXISTS idx_skill_endorsements_profile
  ON skill_endorsements (profile_did, skill_key);

CREATE INDEX IF NOT EXISTS idx_skill_endorsements_endorser
  ON skill_endorsements (endorser_did);

CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY,
  profile_did TEXT NOT NULL,
  actor_did TEXT,
  type TEXT NOT NULL,
  skill TEXT,
  message TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_profile
  ON timeline_events (profile_did, created_at DESC);
