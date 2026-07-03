import { getBlueskyProfile } from '../../_lib/oauth.js';
import { upsertProfileFromBluesky } from '../../_lib/profile.js';
import { getAppSession } from '../../_lib/session.js';
import { handleError, HttpError, json } from '../../_lib/http.js';

export async function onRequestPost({ request, env }) {
  try {
    const appSession = await getAppSession(env, request);
    if (!appSession) {
      throw new HttpError('Authentication required', 401);
    }

    const blueskyProfile = await getBlueskyProfile(appSession.did);
    const profile = await upsertProfileFromBluesky(env, appSession.did, blueskyProfile);

    return json({ profile });
  } catch (error) {
    return handleError(error);
  }
}
