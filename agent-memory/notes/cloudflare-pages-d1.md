# Cloudflare Pages And D1

## Production Facts

- Live site: `https://pdxhc.org`
- Pages project: `pdxhc`
- D1 binding: `DB`
- D1 database name: `pdxhc`
- D1 database ID: `81187982-7c5e-4721-8b0b-d2cb967dcda0`
- Public origin in `wrangler.jsonc`: `https://pdxhc.org`

## Verified Commands

Build:

```bash
npm run build
```

Layout verification:

```bash
npm run verify:layout
```

Local D1 migrations:

```bash
XDG_CONFIG_HOME=/tmp/pdxhc-wrangler-config WRANGLER_LOG_PATH=/tmp/pdxhc-wrangler-logs WRANGLER_SEND_METRICS=false npx wrangler d1 migrations apply DB --local --persist-to .wrangler/state
```

Remote D1 migrations:

```bash
TOKEN=$(sed -n 's/^access_token = "\(.*\)"/\1/p' /home/pierce/.cf/config.toml)
XDG_CONFIG_HOME=/tmp/pdxhc-wrangler-config WRANGLER_LOG_PATH=/tmp/pdxhc-wrangler-logs WRANGLER_SEND_METRICS=false CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 migrations apply DB --remote
```

Manual deploy:

```bash
TOKEN=$(sed -n 's/^access_token = "\(.*\)"/\1/p' /home/pierce/.cf/config.toml)
XDG_CONFIG_HOME=/tmp/pdxhc-wrangler-config WRANGLER_LOG_PATH=/tmp/pdxhc-wrangler-logs WRANGLER_SEND_METRICS=false CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler pages deploy dist --project-name=pdxhc --branch=main
```

## Pitfalls

- If Wrangler reports an invalid access token, run `cf auth whoami` to refresh the OAuth token stored by the `cf` CLI, then retry.
- Local Pages and Playwright checks may need escalation because the sandbox can block binding `127.0.0.1`.
- For Cloudflare Pages SPA routes, `public/_redirects` should rewrite `/account` and `/u/*` to `/`, not `/index.html`.
