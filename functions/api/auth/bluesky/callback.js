import { createOAuthClient, getBlueskyProfile } from '../../../_lib/oauth.js';
import { redirect } from '../../../_lib/http.js';
import { createAppSession, sessionCookie } from '../../../_lib/session.js';
import { upsertProfileFromBluesky } from '../../../_lib/profile.js';

export async function onRequestGet({ request, env }) {
  const client = createOAuthClient(env);
  const params = new URL(request.url).searchParams;

  try {
    const { session, state } = await client.callback(params);
    const did = session.did;

    let bskyProfile = {};
    try {
      bskyProfile = await getBlueskyProfile(session);
    } catch (error) {
      console.error('Unable to fetch Bluesky profile after OAuth callback', error);
    }

    await upsertProfileFromBluesky(env, did, bskyProfile);
    const appSession = await createAppSession(env, did);

    const headers = new Headers();
    headers.append('set-cookie', sessionCookie(appSession));

    return redirect(readReturnTo(state, '/?auth=success#profile'), headers);
  } catch (error) {
    console.error('Bluesky OAuth callback failed', error);
    return redirect('/?auth=error#profile');
  }
}

function readReturnTo(state, fallback) {
  if (!state) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(state);
    return safeReturnTo(parsed.returnTo, fallback);
  } catch {
    return fallback;
  }
}

function safeReturnTo(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  return value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

