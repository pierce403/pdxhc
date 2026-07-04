import { ensureProfile, getProfile, updateProfile } from '../_lib/profile.js';
import { getAppSession } from '../_lib/session.js';
import { handleError, HttpError, json, readJson } from '../_lib/http.js';
import type { AppEnv, AppSession } from '../_lib/types.js';

export const onRequestGet: PagesFunction<AppEnv> = async ({ request, env }) => {
  try {
    const appSession = await requireSession(env, request);
    const profile = (await getProfile(env, appSession.did)) || (await ensureProfile(env, appSession.did));

    return json({ profile });
  } catch (error) {
    return handleError(error);
  }
};

export const onRequestPut: PagesFunction<AppEnv> = async ({ request, env }) => {
  try {
    const appSession = await requireSession(env, request);
    await ensureProfile(env, appSession.did);

    const body = await readJson(request, 16384);
    const profile = await updateProfile(env, appSession.did, body);

    return json({ profile });
  } catch (error) {
    return handleError(error);
  }
};

async function requireSession(env: AppEnv, request: Request): Promise<AppSession> {
  const appSession = await getAppSession(env, request);
  if (!appSession) {
    throw new HttpError('Authentication required', 401);
  }

  return appSession;
}
