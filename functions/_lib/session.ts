import { nowSeconds } from './data.js';
import type { AppEnv, AppSession, NewAppSession } from './types.js';

export const SESSION_COOKIE = 'pdxhc_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }
  return null;
}

export async function createAppSession(env: AppEnv, did: string): Promise<NewAppSession> {
  const id = crypto.randomUUID();
  const expiresAt = nowSeconds() + SESSION_TTL_SECONDS;

  await env.DB.prepare(
    `INSERT INTO app_sessions (id, did, expires_at, updated_at)
     VALUES (?1, ?2, ?3, unixepoch())`
  )
    .bind(id, did, expiresAt)
    .run();

  return {
    id,
    did,
    expiresAt
  };
}

export async function getAppSession(env: AppEnv, request: Request): Promise<AppSession | null> {
  const sessionId = getCookie(request, SESSION_COOKIE);
  if (!sessionId) {
    return null;
  }

  const row = await env.DB.prepare(
    `SELECT id, did, expires_at
     FROM app_sessions
     WHERE id = ?1`
  )
    .bind(sessionId)
    .first<AppSession>();

  if (!row) {
    return null;
  }

  if (row.expires_at <= nowSeconds()) {
    await deleteAppSession(env, sessionId);
    return null;
  }

  return row;
}

export async function deleteAppSession(env: AppEnv, sessionId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM app_sessions WHERE id = ?1').bind(sessionId).run();
}

export function sessionCookie(session: NewAppSession): string {
  const maxAge = Math.max(0, session.expiresAt - nowSeconds());
  return `${SESSION_COOKIE}=${encodeURIComponent(session.id)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
