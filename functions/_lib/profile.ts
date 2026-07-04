import { HttpError } from './http.js';
import type {
  AppEnv,
  BlueskyProfile,
  DirectoryProfile,
  Profile,
  PublicProfile,
  SkillEndorsement,
  TimelineEvent
} from './types.js';

const PROFILE_FIELDS = [
  'did',
  'handle',
  'display_name',
  'avatar_url',
  'banner_url',
  'headline',
  'location',
  'availability',
  'skills',
  'website',
  'linkedin_url',
  'bio',
  'created_at',
  'updated_at'
];

interface ProfileRow {
  did: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  headline: string | null;
  location: string | null;
  availability: string | null;
  skills: string | null;
  website: string | null;
  linkedin_url: string | null;
  bio: string | null;
  created_at: number | null;
  updated_at: number | null;
}

interface SanitizedProfileInput {
  display_name: string;
  headline: string;
  location: string;
  availability: string;
  skills: string[];
  website: string;
  linkedin_url: string;
  bio: string;
}

interface SkillEndorsementRow {
  skill_key: string;
  count: number;
  endorsed_by_viewer: number;
}

interface TimelineRow {
  id: string;
  type: string | null;
  skill: string | null;
  message: string | null;
  actor_did: string | null;
  created_at: number | null;
  actor_handle: string | null;
  actor_display_name: string | null;
  actor_avatar_url: string | null;
}

export async function getProfile(env: AppEnv, did: string): Promise<Profile | null> {
  const row = await env.DB.prepare(
    `SELECT ${PROFILE_FIELDS.join(', ')}
     FROM profiles
     WHERE did = ?1`
  )
    .bind(did)
    .first<ProfileRow>();

  return row ? normalizeProfileRow(row) : null;
}

export async function getPublicProfile(env: AppEnv, did: string, viewerDid = ''): Promise<PublicProfile | null> {
  const profile = await getProfile(env, did);
  if (!profile) {
    return null;
  }

  const [skillEndorsements, timeline] = await Promise.all([
    listSkillEndorsements(env, did, profile.skills, viewerDid),
    listTimelineEvents(env, did)
  ]);

  return {
    ...profile,
    skill_endorsements: skillEndorsements,
    timeline
  };
}

export async function ensureProfile(env: AppEnv, did: string): Promise<Profile> {
  await env.DB.prepare('INSERT OR IGNORE INTO profiles (did) VALUES (?1)').bind(did).run();
  const profile = await getProfile(env, did);
  if (!profile) {
    throw new Error(`Profile could not be loaded after ensure: ${did}`);
  }

  return profile;
}

export async function upsertProfileFromBluesky(
  env: AppEnv,
  did: string,
  bskyProfile: BlueskyProfile = {}
): Promise<Profile> {
  const handle = optionalString(bskyProfile.handle, 253);
  const displayName = optionalString(bskyProfile.displayName, 80);
  const avatar = optionalString(bskyProfile.avatar, 500);
  const banner = optionalString(bskyProfile.banner, 500);
  const bio = optionalString(bskyProfile.description, 600);

  await env.DB.prepare(
    `INSERT INTO profiles (did, handle, display_name, avatar_url, banner_url, bio, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, unixepoch())
     ON CONFLICT(did) DO UPDATE SET
       handle = excluded.handle,
       avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), profiles.avatar_url),
       banner_url = COALESCE(NULLIF(excluded.banner_url, ''), profiles.banner_url),
       display_name = COALESCE(NULLIF(profiles.display_name, ''), excluded.display_name),
       bio = COALESCE(NULLIF(profiles.bio, ''), excluded.bio),
       updated_at = unixepoch()`
  )
    .bind(did, handle, displayName, avatar, banner, bio)
    .run();

  const profile = await getProfile(env, did);
  if (!profile) {
    throw new Error(`Profile could not be loaded after Bluesky upsert: ${did}`);
  }

  return profile;
}

export async function updateProfile(env: AppEnv, did: string, input: unknown): Promise<Profile> {
  const profile = sanitizeProfileInput(input);

  await env.DB.prepare(
    `UPDATE profiles
     SET display_name = ?1,
         headline = ?2,
         location = ?3,
         availability = ?4,
         skills = ?5,
         website = ?6,
         linkedin_url = ?7,
         bio = ?8,
         updated_at = unixepoch()
     WHERE did = ?9`
  )
    .bind(
      profile.display_name,
      profile.headline,
      profile.location,
      profile.availability,
      JSON.stringify(profile.skills),
      profile.website,
      profile.linkedin_url,
      profile.bio,
      did
    )
    .run();

  const updatedProfile = await getProfile(env, did);
  if (!updatedProfile) {
    throw new HttpError('Profile not found', 404);
  }

  return updatedProfile;
}

export async function endorseSkill(
  env: AppEnv,
  profileDid: string,
  skill: string,
  endorserDid: string
): Promise<PublicProfile> {
  if (profileDid === endorserDid) {
    throw new HttpError('You cannot endorse your own profile', 422);
  }

  const profile = await getProfile(env, profileDid);
  if (!profile) {
    throw new HttpError('Profile not found', 404);
  }

  const endorsedSkill = findProfileSkill(profile.skills, skill);
  if (!endorsedSkill) {
    throw new HttpError('That skill is not listed on this profile', 422);
  }

  const skillKey = normalizeSkillKey(endorsedSkill);
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO skill_endorsements (id, profile_did, skill, skill_key, endorser_did, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, unixepoch())`
  )
    .bind(crypto.randomUUID(), profileDid, endorsedSkill, skillKey, endorserDid)
    .run();

  if ((result.meta?.changes || 0) > 0) {
    await env.DB.prepare(
      `INSERT INTO timeline_events (id, profile_did, actor_did, type, skill, created_at)
       VALUES (?1, ?2, ?3, 'skill_endorsement', ?4, unixepoch())`
    )
      .bind(crypto.randomUUID(), profileDid, endorserDid, endorsedSkill)
      .run();
  }

  const publicProfile = await getPublicProfile(env, profileDid, endorserDid);
  if (!publicProfile) {
    throw new HttpError('Profile not found', 404);
  }

  return publicProfile;
}

export async function removeSkillEndorsement(
  env: AppEnv,
  profileDid: string,
  skill: string,
  endorserDid: string
): Promise<PublicProfile> {
  const profile = await getProfile(env, profileDid);
  if (!profile) {
    throw new HttpError('Profile not found', 404);
  }

  const endorsedSkill = findProfileSkill(profile.skills, skill);
  if (!endorsedSkill) {
    throw new HttpError('That skill is not listed on this profile', 422);
  }

  await env.DB.prepare(
    `DELETE FROM skill_endorsements
     WHERE profile_did = ?1
       AND skill_key = ?2
       AND endorser_did = ?3`
  )
    .bind(profileDid, normalizeSkillKey(endorsedSkill), endorserDid)
    .run();

  const publicProfile = await getPublicProfile(env, profileDid, endorserDid);
  if (!publicProfile) {
    throw new HttpError('Profile not found', 404);
  }

  return publicProfile;
}

export async function listProfiles(env: AppEnv, query = ''): Promise<DirectoryProfile[]> {
  const sanitizedQuery = optionalString(query, 120);
  const baseWhere =
    `(COALESCE(handle, '') <> ''
      OR COALESCE(display_name, '') <> ''
      OR COALESCE(headline, '') <> ''
      OR COALESCE(availability, '') <> ''
      OR COALESCE(location, '') <> ''
      OR COALESCE(website, '') <> ''
      OR COALESCE(linkedin_url, '') <> ''
      OR COALESCE(bio, '') <> ''
      OR COALESCE(skills, '[]') <> '[]')`;

  let statement: D1PreparedStatement;
  if (sanitizedQuery) {
    const term = `%${escapeLike(sanitizedQuery.toLowerCase())}%`;
    statement = env.DB.prepare(
      `SELECT ${PROFILE_FIELDS.join(', ')}
       FROM profiles
       WHERE ${baseWhere}
         AND (
           LOWER(COALESCE(handle, '')) LIKE ?1 ESCAPE '\\'
           OR LOWER(COALESCE(display_name, '')) LIKE ?1 ESCAPE '\\'
           OR LOWER(COALESCE(headline, '')) LIKE ?1 ESCAPE '\\'
           OR LOWER(COALESCE(location, '')) LIKE ?1 ESCAPE '\\'
           OR LOWER(COALESCE(availability, '')) LIKE ?1 ESCAPE '\\'
           OR LOWER(COALESCE(website, '')) LIKE ?1 ESCAPE '\\'
           OR LOWER(COALESCE(linkedin_url, '')) LIKE ?1 ESCAPE '\\'
           OR LOWER(COALESCE(skills, '')) LIKE ?1 ESCAPE '\\'
           OR LOWER(COALESCE(bio, '')) LIKE ?1 ESCAPE '\\'
         )
       ORDER BY updated_at DESC
       LIMIT 50`
    ).bind(term);
  } else {
    statement = env.DB.prepare(
      `SELECT ${PROFILE_FIELDS.join(', ')}
       FROM profiles
       WHERE ${baseWhere}
       ORDER BY updated_at DESC
       LIMIT 50`
    );
  }

  const result = await statement.all<ProfileRow>();
  return (result.results || []).map(normalizeDirectoryProfile);
}

async function listSkillEndorsements(
  env: AppEnv,
  did: string,
  skills: string[],
  viewerDid: string
): Promise<SkillEndorsement[]> {
  if (!skills.length) {
    return [];
  }

  const result = await env.DB.prepare(
    `SELECT skill_key,
            COUNT(*) AS count,
            MAX(CASE WHEN endorser_did = ?2 THEN 1 ELSE 0 END) AS endorsed_by_viewer
     FROM skill_endorsements
     WHERE profile_did = ?1
     GROUP BY skill_key`
  )
    .bind(did, viewerDid || '')
    .all<SkillEndorsementRow>();

  const endorsementMap = new Map(
    (result.results || []).map((row): [string, Omit<SkillEndorsement, 'skill' | 'skill_key'>] => [
      row.skill_key,
      {
        count: Number(row.count || 0),
        endorsed_by_viewer: Boolean(row.endorsed_by_viewer)
      }
    ])
  );

  return skills.map((skill) => {
    const skill_key = normalizeSkillKey(skill);
    const endorsement = endorsementMap.get(skill_key) || {
      count: 0,
      endorsed_by_viewer: false
    };

    return {
      skill,
      skill_key,
      ...endorsement
    };
  });
}

async function listTimelineEvents(env: AppEnv, did: string): Promise<TimelineEvent[]> {
  const result = await env.DB.prepare(
    `SELECT events.id,
            events.type,
            events.skill,
            events.message,
            events.actor_did,
            events.created_at,
            actors.handle AS actor_handle,
            actors.display_name AS actor_display_name,
            actors.avatar_url AS actor_avatar_url
     FROM timeline_events AS events
     LEFT JOIN profiles AS actors ON actors.did = events.actor_did
     WHERE events.profile_did = ?1
     ORDER BY events.created_at DESC
     LIMIT 30`
  )
    .bind(did)
    .all<TimelineRow>();

  return (result.results || []).map(normalizeTimelineEvent);
}

export function normalizeProfileRow(row: ProfileRow): Profile {
  return {
    did: row.did,
    handle: row.handle || '',
    display_name: row.display_name || '',
    avatar_url: row.avatar_url || '',
    banner_url: row.banner_url || '',
    headline: row.headline || '',
    location: row.location || '',
    availability: row.availability || '',
    skills: parseSkills(row.skills),
    website: row.website || '',
    linkedin_url: row.linkedin_url || '',
    bio: row.bio || '',
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

function normalizeDirectoryProfile(row: ProfileRow): DirectoryProfile {
  const profile = normalizeProfileRow(row);
  return {
    did: profile.did,
    handle: profile.handle,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    banner_url: profile.banner_url,
    headline: profile.headline,
    location: profile.location,
    availability: profile.availability,
    skills: profile.skills,
    website: profile.website,
    linkedin_url: profile.linkedin_url,
    bio: profile.bio,
    updated_at: profile.updated_at
  };
}

function sanitizeProfileInput(input: unknown): SanitizedProfileInput {
  const source = isRecord(input) ? input : {};
  const website = optionalString(source.website, 200);
  const linkedinUrl = optionalString(source.linkedin_url, 240);

  return {
    display_name: optionalString(source.display_name, 80),
    headline: optionalString(source.headline, 140),
    location: optionalString(source.location, 80),
    availability: optionalString(source.availability, 80),
    skills: sanitizeSkills(source.skills),
    website: validateWebsite(website),
    linkedin_url: validateLinkedInUrl(linkedinUrl),
    bio: optionalString(source.bio, 600)
  };
}

function sanitizeSkills(value: unknown): string[] {
  const rawSkills = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  const skillMap = new Map();
  for (const rawSkill of rawSkills) {
    const skill = normalizeSkillLabel(rawSkill);
    const key = normalizeSkillKey(skill);
    if (skill && !skillMap.has(key)) {
      skillMap.set(key, skill);
    }
  }

  return Array.from(skillMap.values()).slice(0, 12);
}

function parseSkills(value: unknown): string[] {
  try {
    const parsed = JSON.parse(typeof value === 'string' ? value : '[]');
    return Array.isArray(parsed) ? parsed.filter((skill) => typeof skill === 'string') : [];
  } catch {
    return [];
  }
}

function normalizeTimelineEvent(row: TimelineRow): TimelineEvent {
  return {
    id: row.id,
    type: row.type || '',
    skill: row.skill || '',
    message: row.message || '',
    created_at: row.created_at || null,
    actor: {
      did: row.actor_did || '',
      handle: row.actor_handle || '',
      display_name: row.actor_display_name || '',
      avatar_url: row.actor_avatar_url || ''
    }
  };
}

function findProfileSkill(skills: string[], value: string): string {
  const key = normalizeSkillKey(value);
  return skills.find((skill) => normalizeSkillKey(skill) === key) || '';
}

export function normalizeSkillLabel(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\s+/g, ' ').slice(0, 40);
}

export function normalizeSkillKey(value: unknown): string {
  return normalizeSkillLabel(value).toLowerCase();
}

function validateWebsite(value: string): string {
  if (!value) {
    return '';
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError('Website must be a valid URL', 422);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new HttpError('Website must use http or https', 422);
  }

  return url.toString();
}

function validateLinkedInUrl(value: string): string {
  if (!value) {
    return '';
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError('LinkedIn must be a valid URL', 422);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new HttpError('LinkedIn must use http or https', 422);
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname !== 'linkedin.com' && !hostname.endsWith('.linkedin.com')) {
    throw new HttpError('LinkedIn URL must be on linkedin.com', 422);
  }

  return url.toString();
}

function optionalString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function escapeLike(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
