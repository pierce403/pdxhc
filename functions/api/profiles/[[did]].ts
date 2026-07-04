import { getPublicProfile } from '../../_lib/profile.js';
import { handleError, HttpError, json } from '../../_lib/http.js';
import { getAppSession } from '../../_lib/session.js';
import type { AppEnv } from '../../_lib/types.js';

export const onRequestGet: PagesFunction<AppEnv, 'did'> = async ({ request, params, env }) => {
  try {
    const did = readDid(params.did);
    const appSession = await getAppSession(env, request);
    const profile = await getPublicProfile(env, did, appSession?.did || '');

    if (!profile) {
      throw new HttpError('Profile not found', 404);
    }

    return json({ profile });
  } catch (error) {
    return handleError(error);
  }
};

function readDid(value: string | string[] | undefined): string {
  const did = decodeURIComponent(Array.isArray(value) ? value.join('/') : value || '');
  if (!did.startsWith('did:plc:') && !did.startsWith('did:web:')) {
    throw new HttpError('Invalid profile id', 400);
  }

  return did;
}
