# pdxhc-profile-app

Use this skill when touching Bluesky auth, profile editing, directory search, public profiles, D1 schema, or Pages Functions.

## Files To Check

- `src/App.vue` - routed Vue UI for landing, account, directory, and public profile views.
- `src/style.css` - layout and responsive behavior.
- `functions/_lib/profile.js` - profile persistence, normalization, validation, and directory search.
- `functions/_lib/oauth.js` - ATProto OAuth and public Bluesky profile lookup.
- `functions/api/profile.js` - authenticated profile update API.
- `functions/api/profile/sync-bluesky.js` - authenticated Bluesky sync API.
- `functions/api/profiles/[[did]].js` - public profile API.
- `functions/api/directory.js` - public directory API.
- `migrations/` - D1 schema changes.
- `public/_redirects` - direct SPA route rewrites.
- `scripts/verify-layout.mjs` - Playwright layout coverage.

## Rules

- Add D1 schema changes as migrations.
- Keep profile input validation server-side.
- Do not overwrite manually edited profile fields during Bluesky sync unless the existing value is empty.
- Keep direct route support for `/account` and `/u/<did>`.
- Update the layout verifier when adding important states or pages.

## Smoke Tests

```bash
npm run build
npm run verify:layout
```

With local Pages preview running on `8788`:

```bash
curl -sS -I http://127.0.0.1:8788/account
curl -sS -I http://127.0.0.1:8788/u/did:plc:layouttest
curl -sS -i http://127.0.0.1:8788/api/profiles/did:plc:missing
curl -sS -i -X POST http://127.0.0.1:8788/api/profile/sync-bluesky
```

Expected unauthenticated sync response is `401`.
