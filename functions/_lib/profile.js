import { HttpError } from './http.js';

const PROFILE_FIELDS = [
  'did',
  'handle',
  'display_name',
  'avatar_url',
  'headline',
  'location',
  'availability',
  'skills',
  'website',
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

export async function ensureProfile(env, did) {
  await env.DB.prepare('INSERT OR IGNORE INTO profiles (did) VALUES (?1)').bind(did).run();
  return getProfile(env, did);
}

export async function upsertProfileFromBluesky(env, did, bskyProfile = {}) {
  const handle = optionalString(bskyProfile.handle, 253);
  const displayName = optionalString(bskyProfile.displayName, 80);
  const avatar = optionalString(bskyProfile.avatar, 500);
  const bio = optionalString(bskyProfile.description, 600);

  await env.DB.prepare(
    `INSERT INTO profiles (did, handle, display_name, avatar_url, bio, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, unixepoch())
     ON CONFLICT(did) DO UPDATE SET
       handle = excluded.handle,
       avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), profiles.avatar_url),
       display_name = COALESCE(NULLIF(profiles.display_name, ''), excluded.display_name),
       bio = COALESCE(NULLIF(profiles.bio, ''), excluded.bio),
       updated_at = unixepoch()`
  )
    .bind(did, handle, displayName, avatar, bio)
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
         bio = ?7,
         updated_at = unixepoch()
     WHERE did = ?8`
  )
    .bind(
      profile.display_name,
      profile.headline,
      profile.location,
      profile.availability,
      JSON.stringify(profile.skills),
      profile.website,
      profile.bio,
      did
    )
    .run();

  return getProfile(env, did);
}

export async function listProfiles(env, query = '') {
  const sanitizedQuery = optionalString(query, 120);
  const baseWhere =
    `(COALESCE(handle, '') <> ''
      OR COALESCE(display_name, '') <> ''
      OR COALESCE(headline, '') <> ''
      OR COALESCE(availability, '') <> ''
      OR COALESCE(location, '') <> ''
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

export function normalizeProfileRow(row) {
  return {
    did: row.did,
    handle: row.handle || '',
    display_name: row.display_name || '',
    avatar_url: row.avatar_url || '',
    headline: row.headline || '',
    location: row.location || '',
    availability: row.availability || '',
    skills: parseSkills(row.skills),
    website: row.website || '',
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
    headline: profile.headline,
    location: profile.location,
    availability: profile.availability,
    skills: profile.skills,
    website: profile.website,
    bio: profile.bio,
    updated_at: profile.updated_at
  };
}

function sanitizeProfileInput(input) {
  const website = optionalString(input.website, 200);

  return {
    display_name: optionalString(input.display_name, 80),
    headline: optionalString(input.headline, 140),
    location: optionalString(input.location, 80),
    availability: optionalString(input.availability, 80),
    skills: sanitizeSkills(input.skills),
    website: validateWebsite(website),
    bio: optionalString(input.bio, 600)
  };
}

function sanitizeSkills(value) {
  const rawSkills = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  const skills = rawSkills
    .map((skill) => optionalString(skill, 40))
    .filter(Boolean)
    .slice(0, 12);

  return Array.from(new Set(skills));
}

function parseSkills(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter((skill) => typeof skill === 'string') : [];
  } catch {
    return [];
  }
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

function optionalString(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function escapeLike(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}
