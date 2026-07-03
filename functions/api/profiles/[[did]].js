import { getProfile } from '../../_lib/profile.js';
import { handleError, HttpError, json } from '../../_lib/http.js';

export async function onRequestGet({ params, env }) {
  try {
    const did = readDid(params.did);
    const profile = await getProfile(env, did);

    if (!profile) {
      throw new HttpError('Profile not found', 404);
    }

    return json({ profile });
  } catch (error) {
    return handleError(error);
  }
}

function readDid(value) {
  const did = decodeURIComponent(Array.isArray(value) ? value.join('/') : value || '');
  if (!did.startsWith('did:plc:') && !did.startsWith('did:web:')) {
    throw new HttpError('Invalid profile id', 400);
  }

  return did;
}
