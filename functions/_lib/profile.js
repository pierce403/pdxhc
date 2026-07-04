import { HttpError } from './http.js';

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

export async function getProfile(env, did) {
  const row = await env.DB.prepare(
    `SELECT ${PROFILE_FIELDS.join(', ')}
     FROM profiles
     WHERE did = ?1`
  )
    .bind(did)
    .first();

  return row ? normalizeProfileRow(row) : null;
}

export async function getPublicProfile(env, did, viewerDid = '') {
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

export async function ensureProfile(env, did) {
  await env.DB.prepare('INSERT OR IGNORE INTO profiles (did) VALUES (?1)').bind(did).run();
  return getProfile(env, did);
}

export async function upsertProfileFromBluesky(env, did, bskyProfile = {}) {
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

  return getProfile(env, did);
}

export async function updateProfile(env, did, input) {
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

  return getProfile(env, did);
}

export async function endorseSkill(env, profileDid, skill, endorserDid) {
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

  return getPublicProfile(env, profileDid, endorserDid);
}

export async function removeSkillEndorsement(env, profileDid, skill, endorserDid) {
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

  return getPublicProfile(env, profileDid, endorserDid);
}

export async function listProfiles(env, query = '') {
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

  let statement;
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

  const result = await statement.all();
  return (result.results || []).map(normalizeDirectoryProfile);
}

async function listSkillEndorsements(env, did, skills, viewerDid) {
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
    .all();

  const endorsementMap = new Map(
    (result.results || []).map((row) => [
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

async function listTimelineEvents(env, did) {
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
    .all();

  return (result.results || []).map(normalizeTimelineEvent);
}

export function normalizeProfileRow(row) {
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

function normalizeDirectoryProfile(row) {
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

function sanitizeProfileInput(input) {
  const website = optionalString(input.website, 200);
  const linkedinUrl = optionalString(input.linkedin_url, 240);

  return {
    display_name: optionalString(input.display_name, 80),
    headline: optionalString(input.headline, 140),
    location: optionalString(input.location, 80),
    availability: optionalString(input.availability, 80),
    skills: sanitizeSkills(input.skills),
    website: validateWebsite(website),
    linkedin_url: validateLinkedInUrl(linkedinUrl),
    bio: optionalString(input.bio, 600)
  };
}

function sanitizeSkills(value) {
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

function parseSkills(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter((skill) => typeof skill === 'string') : [];
  } catch {
    return [];
  }
}

function normalizeTimelineEvent(row) {
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

function findProfileSkill(skills, value) {
  const key = normalizeSkillKey(value);
  return skills.find((skill) => normalizeSkillKey(skill) === key) || '';
}

export function normalizeSkillLabel(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\s+/g, ' ').slice(0, 40);
}

export function normalizeSkillKey(value) {
  return normalizeSkillLabel(value).toLowerCase();
}

function validateWebsite(value) {
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

function validateLinkedInUrl(value) {
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

function optionalString(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function escapeLike(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}
