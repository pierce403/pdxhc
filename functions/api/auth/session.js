import { ensureProfile, getProfile } from '../../_lib/profile.js';
import { clearSessionCookie, deleteAppSession, getAppSession, getCookie, SESSION_COOKIE } from '../../_lib/session.js';
import { handleError, json } from '../../_lib/http.js';

export async function onRequestGet({ request, env }) {
  try {
    const appSession = await getAppSession(env, request);
    if (!appSession) {
      return json({ authenticated: false, profile: null });
    }

    const profile = (await getProfile(env, appSession.did)) || (await ensureProfile(env, appSession.did));
    return json({ authenticated: true, profile });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const sessionId = getCookie(request, SESSION_COOKIE);
    if (sessionId) {
      await deleteAppSession(env, sessionId);
    }

    return json(
      { authenticated: false },
      {
        headers: {
          'set-cookie': clearSessionCookie()
        }
      }
    );
  } catch (error) {
    return handleError(error);
  }
}

