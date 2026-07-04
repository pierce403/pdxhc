# Portland Hacker Collective

Landing page for the Portland Hacker Collective, a local directory for hackers and businesses coordinating short-term technical contracts.

Live site: <https://pdxhc.org>

## Stack

- Vue on Vite for the frontend.
- Cloudflare Pages for deploys.
- Cloudflare Pages Functions for auth and profile APIs.
- Cloudflare D1 for OAuth state, OAuth sessions, first-party sessions, and profile data.
- ATProto OAuth for Bluesky login.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production output is `dist/`.

## Cloudflare Pages

Preferred setup is Cloudflare Pages Git integration against `pierce403/pdxhc`:

- Project name: `pdxhc`
- Repository: `pierce403/pdxhc`
- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`

Pushing to `main` deploys through the Cloudflare Pages GitHub integration.

Manual deploy fallback for the existing Pages project:

```bash
npm run deploy
```

Preview the Cloudflare Pages output locally:

```bash
npm run cf:preview
```

Apply the D1 schema locally:

```bash
wrangler d1 migrations apply DB --local --persist-to .wrangler/state
```

Apply the D1 schema remotely:

```bash
wrangler d1 migrations apply DB --remote
```

The production D1 binding is named `DB` and points at the `pdxhc` database.

## App routes

- `/account` is the authenticated profile editor.
- `/u/<did>` is a public profile page, for example `/u/did:plc:example`.
- `/api/directory` returns searchable public profiles for the directory.

## Agent operating docs

This repo keeps Recurse.bot-style operating guidance in `AGENTS.md`, with `CLAUDE.md` and `GEMINI.md` symlinked to it. Repo-local memory starts at `MEMORY.md`, and repeatable workflows are indexed in `SKILLS.md`.

## DNS

Exact DNS records depend on the domain or subdomain selected for the site.

If the domain is already on Cloudflare:

1. Add the domain or subdomain under the Cloudflare Pages project custom domains.
2. For `www`, create a proxied `CNAME` record pointing to `pdxhc.pages.dev` if Cloudflare does not create it automatically.
3. For the apex domain, attach it through Pages custom domains so Cloudflare can handle the flattened DNS target.

If the domain is registered outside Cloudflare:

1. Add the zone to Cloudflare.
2. Update the registrar nameservers to the two Cloudflare nameservers assigned to the zone.
3. Attach the Pages custom domain after Cloudflare marks the zone active.

The installed `cf` CLI can manage zones and DNS records once authenticated, for example:

```bash
cf auth login
cf zones create-zones-post --name example.com --account-id <account-id>
cf context set zone example.com -p
cf dns records create --body '{"type":"CNAME","name":"www","content":"pdxhc.pages.dev","proxied":true}'
```

Replace `example.com` with the actual domain before running those commands.
