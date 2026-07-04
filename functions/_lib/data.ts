const STORE_TABLES = new Set(['oauth_states', 'oauth_sessions']);

type StoreTable = 'oauth_states' | 'oauth_sessions';

interface JsonStoreOptions {
  ttlSeconds?: number;
}

interface JsonStore<T> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
}

interface StoreRow {
  value: string;
  expires_at: number | null;
}

export function createJsonStore<T = unknown>(
  db: D1Database,
  table: StoreTable,
  options: JsonStoreOptions = {}
): JsonStore<T> {
  if (!STORE_TABLES.has(table)) {
    throw new TypeError(`Unsupported store table: ${table}`);
  }

  const ttlSeconds = options.ttlSeconds || null;

  return {
    async get(key) {
      const row = await db
        .prepare(`SELECT value, expires_at FROM ${table} WHERE key = ?1`)
        .bind(key)
        .first<StoreRow>();

      if (!row) {
        return undefined;
      }

      if (typeof row.expires_at === 'number' && row.expires_at <= nowSeconds()) {
        await this.del(key);
        return undefined;
      }

      return JSON.parse(row.value) as T;
    },

    async set(key, value) {
      const expiresAt = ttlSeconds ? nowSeconds() + ttlSeconds : null;
      await db
        .prepare(
          `INSERT INTO ${table} (key, value, expires_at, updated_at)
           VALUES (?1, ?2, ?3, unixepoch())
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             expires_at = excluded.expires_at,
             updated_at = unixepoch()`
        )
        .bind(key, JSON.stringify(value), expiresAt)
        .run();
    },

    async del(key) {
      await db.prepare(`DELETE FROM ${table} WHERE key = ?1`).bind(key).run();
    }
  };
}

export function createD1RequestLock(db: D1Database) {
  return async <T>(name: string, fn: () => PromiseLike<T> | T): Promise<T> => {
    const token = crypto.randomUUID();
    const startedAt = Date.now();

    while (!(await acquireLock(db, name, token))) {
      if (Date.now() - startedAt > 5000) {
        throw new Error(`Timed out waiting for OAuth lock: ${name}`);
      }
      await sleep(100);
    }

    try {
      return await fn();
    } finally {
      await db
        .prepare('DELETE FROM oauth_locks WHERE name = ?1 AND token = ?2')
        .bind(name, token)
        .run();
    }
  };
}

async function acquireLock(db: D1Database, name: string, token: string): Promise<boolean> {
  const expiresAt = nowSeconds() + 15;
  const result = await db
    .prepare(
      `INSERT INTO oauth_locks (name, token, expires_at)
       VALUES (?1, ?2, ?3)
       ON CONFLICT(name) DO UPDATE SET
         token = excluded.token,
         expires_at = excluded.expires_at
       WHERE oauth_locks.expires_at < ?4`
    )
    .bind(name, token, expiresAt, nowSeconds())
    .run();

  return Boolean(result.meta?.changes);
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
