# Profile And Directory Notes

## Current Behavior

- `/account` is the authenticated profile editor.
- `/u/<did>` is the public profile page.
- `/api/directory` returns searchable public profiles.
- `/api/profiles/<did>` returns one public profile.
- `/api/profile/sync-bluesky` refreshes the authenticated user's public Bluesky handle, avatar, banner, and related basic info.

## Data Model

Profiles currently include:

- `did`
- `handle`
- `display_name`
- `avatar_url`
- `banner_url`
- `headline`
- `location`
- `availability`
- `skills`
- `website`
- `linkedin_url`
- `bio`

## Notes

- `linkedin_url` must be `http` or `https` and on `linkedin.com` or a subdomain.
- Bluesky public profile data comes from `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile`.
- Manual profile fields should not be overwritten by Bluesky sync unless the existing value is empty.
- Directory search includes handle, display name, headline, location, availability, website, LinkedIn, skills, and bio.
