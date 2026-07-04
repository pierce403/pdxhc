# AGENTS.md - Instructions for Coding Agents

## Self-Improvement Directive

When working on this project, update this file or the repo memory when you learn something that will help the next agent. Capture working commands, failed commands, deployment details, project conventions, common pitfalls, and collaborator preferences while they are still fresh.

Keep notes concrete and repo-specific. Do not add broad process advice unless it changes how future work should be done here.

## Responsibilities

- Keep `pdxhc.org` deployable on Cloudflare Pages.
- Preserve D1 profile data and use migrations for schema changes.
- Keep profile, directory, and auth flows working across direct routes such as `/account` and `/u/<did>`.
- Verify user-facing layout changes with the Playwright layout verifier.
- Commit focused changes and push `main` when the work is meant to land.

## Project Overview

Portland Hacker Collective is a Vue/Vite app deployed on Cloudflare Pages. Pages Functions provide Bluesky OAuth, profile APIs, and directory APIs. Cloudflare D1 stores OAuth state, first-party sessions, and profile data.

Important production facts:

- Live site: `https://pdxhc.org`
- GitHub repo: `pierce403/pdxhc`
- Pages project: `pdxhc`
- D1 binding: `DB`
- D1 database: `pdxhc`
- D1 database ID: `81187982-7c5e-4721-8b0b-d2cb967dcda0`

## Build, Test, And Preview

Use the repo scripts first:

```bash
npm run build
npm run verify:layout
```

Local Pages preview:

```bash
XDG_CONFIG_HOME=/tmp/pdxhc-wrangler-config WRANGLER_LOG_PATH=/tmp/pdxhc-wrangler-logs WRANGLER_SEND_METRICS=false npx wrangler pages dev dist --port 8788 --persist-to .wrangler/state --log-level warn
```

Local and remote D1 migrations:

```bash
XDG_CONFIG_HOME=/tmp/pdxhc-wrangler-config WRANGLER_LOG_PATH=/tmp/pdxhc-wrangler-logs WRANGLER_SEND_METRICS=false npx wrangler d1 migrations apply DB --local --persist-to .wrangler/state

TOKEN=$(sed -n 's/^access_token = "\(.*\)"/\1/p' /home/pierce/.cf/config.toml)
XDG_CONFIG_HOME=/tmp/pdxhc-wrangler-config WRANGLER_LOG_PATH=/tmp/pdxhc-wrangler-logs WRANGLER_SEND_METRICS=false CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 migrations apply DB --remote
```

Manual production deploy after a verified build:

```bash
TOKEN=$(sed -n 's/^access_token = "\(.*\)"/\1/p' /home/pierce/.cf/config.toml)
XDG_CONFIG_HOME=/tmp/pdxhc-wrangler-config WRANGLER_LOG_PATH=/tmp/pdxhc-wrangler-logs WRANGLER_SEND_METRICS=false CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler pages deploy dist --project-name=pdxhc --branch=main
```

## Coding Conventions

- Follow the existing Vue single-file component and plain CSS structure.
- Use Lucide Vue icons already available through `@lucide/vue`.
- Keep Cloudflare Functions small and share common behavior through `functions/_lib`.
- Validate user-controlled URLs before saving them.
- Add D1 schema changes as files under `migrations/`.
- Keep direct SPA routes covered by `public/_redirects`.

## Known Issues And Solutions

- The sandbox may block local server binds with `listen EPERM`. Re-run local preview or Playwright layout checks with escalation when needed.
- Wrangler can reject a stale OAuth token from `/home/pierce/.cf/config.toml`. Running `cf auth whoami` refreshes the stored token; then retry the Wrangler command.
- The `cf` CLI is useful for account, DNS, and zone checks, but this installed binary does not expose the generated Pages and D1 command groups directly. Use Wrangler for Pages and D1.
- Cloudflare Pages treats `/_redirects` rewrites to `/index.html` for `/u/*` as an infinite-loop risk. Use `/u/* / 200` and `/account / 200`.
- Existing user profile rows may predate newer Bluesky sync fields. Prefer the `/api/profile/sync-bluesky` flow for authenticated users; one-off D1 backfills should only touch sync-managed public fields.

## Agent Tips

- Start important tasks by checking `git status --short`, this file, `MEMORY.md`, and `SKILLS.md`.
- For UI work, update `scripts/verify-layout.mjs` when adding important routes or states.
- For deploy work, verify both the custom domain and an API route after deployment.
- Keep production facts out of vague prose; write exact command lines and IDs when they are not secret.
- Do not put secrets into files or logs. Passing tokens through environment variables is acceptable.

## Memory And Skills

- `MEMORY.md` is the repo-local memory index.
- `agent-memory/notes/` stores durable project observations.
- `agent-memory/logs/` stores dated work records.
- `SKILLS.md` is the skill catalog.
- `skills/<name>/SKILL.md` stores focused workflows.

Open only the memory note or skill needed for the task. Keep these files short enough to be useful in a future context window.

## Harness Compatibility

`AGENTS.md` is canonical. `CLAUDE.md` and `GEMINI.md` should be symlinks to this file so other harnesses read the same instructions.
