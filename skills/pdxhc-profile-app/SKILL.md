# pdxhc-profile-app

Use this skill when touching Bluesky auth, profile editing, directory search, public profiles, D1 schema, or Pages Functions.

## Files To Check

- `src/App.vue` - routed Vue UI for landing, account, directory, and public profile views.
- `src/style.css` - layout and responsive behavior.
- `functions/_lib/profile.ts` - profile persistence, normalization, validation, and directory search.
- `functions/_lib/oauth.ts` - ATProto OAuth and public Bluesky profile lookup.
- `functions/api/profile.ts` - authenticated profile update API.
- `functions/api/profile/sync-bluesky.ts` - authenticated Bluesky sync API.
- `functions/api/profiles/[[did]].ts` - public profile API.
- `functions/api/directory.ts` - public directory API.
- `migrations/` - D1 schema changes.
- `public/_redirects` - direct SPA route rewrites.
- `scripts/verify-layout.mts` - Playwright layout coverage.

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
