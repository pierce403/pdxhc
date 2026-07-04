import {
  endorseSkill,
  ensureProfile,
  removeSkillEndorsement
} from '../_lib/profile.js';
import { getAppSession } from '../_lib/session.js';
import { handleError, HttpError, json, readJsonObject } from '../_lib/http.js';
import type { AppEnv, AppSession, JsonObject } from '../_lib/types.js';

export const onRequestPost: PagesFunction<AppEnv> = async ({ request, env }) => {
  try {
    const appSession = await requireSession(env, request);
    const body = await readJsonObject(request);
    const { profileDid, skill } = readEndorsementInput(body);

    await ensureProfile(env, appSession.did);
    const profile = await endorseSkill(env, profileDid, skill, appSession.did);

    return json({ profile });
  } catch (error) {
    return handleError(error);
  }
};

export const onRequestDelete: PagesFunction<AppEnv> = async ({ request, env }) => {
  try {
    const appSession = await requireSession(env, request);
    const body = await readJsonObject(request);
    const { profileDid, skill } = readEndorsementInput(body);

    const profile = await removeSkillEndorsement(env, profileDid, skill, appSession.did);

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

function readEndorsementInput(body: JsonObject): { profileDid: string; skill: string } {
  const profileDid = typeof body.profile_did === 'string' ? body.profile_did.trim() : '';
  const skill = typeof body.skill === 'string' ? body.skill.trim() : '';

  if (!profileDid.startsWith('did:plc:') && !profileDid.startsWith('did:web:')) {
    throw new HttpError('Invalid profile id', 422);
  }

  if (!skill) {
    throw new HttpError('Skill is required', 422);
  }

  return { profileDid, skill };
}
