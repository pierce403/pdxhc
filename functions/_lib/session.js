import { nowSeconds } from './data.js';

export const SESSION_COOKIE = 'pdxhc_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export function getCookie(request, name) {
  const cookieHeader = request.headers.get('cookie') || '';
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }
  return null;
}

export async function createAppSession(env, did) {
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

export async function getAppSession(env, request) {
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
    .first();

  if (!row) {
    return null;
  }

  if (row.expires_at <= nowSeconds()) {
    await deleteAppSession(env, sessionId);
    return null;
  }

  return row;
}

export async function deleteAppSession(env, sessionId) {
  await env.DB.prepare('DELETE FROM app_sessions WHERE id = ?1').bind(sessionId).run();
}

export function sessionCookie(session) {
  const maxAge = Math.max(0, session.expiresAt - nowSeconds());
  return `${SESSION_COOKIE}=${encodeURIComponent(session.id)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

