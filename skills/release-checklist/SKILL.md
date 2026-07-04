# release-checklist

Use this skill before landing or deploying PDXHC changes.

## Checklist

1. Check the worktree.

```bash
git status --short
```

2. Run the verification that matches the change.

For most app changes:

```bash
npm run build
npm run verify:layout
```

For schema changes, apply migrations locally first:

```bash
XDG_CONFIG_HOME=/tmp/pdxhc-wrangler-config WRANGLER_LOG_PATH=/tmp/pdxhc-wrangler-logs WRANGLER_SEND_METRICS=false npx wrangler d1 migrations apply DB --local --persist-to .wrangler/state
```

Then apply remote migrations:

```bash
TOKEN=$(sed -n 's/^access_token = "\(.*\)"/\1/p' /home/pierce/.cf/config.toml)
XDG_CONFIG_HOME=/tmp/pdxhc-wrangler-config WRANGLER_LOG_PATH=/tmp/pdxhc-wrangler-logs WRANGLER_SEND_METRICS=false CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler d1 migrations apply DB --remote
```

3. Check formatting and accidental whitespace.

```bash
git diff --check
```

4. Commit focused changes.

```bash
git add <paths>
git commit -m "<message>"
```

5. Push `main` when the user expects the work to land.

```bash
git push origin main
```

6. Deploy manually if the live site should update immediately.

```bash
TOKEN=$(sed -n 's/^access_token = "\(.*\)"/\1/p' /home/pierce/.cf/config.toml)
XDG_CONFIG_HOME=/tmp/pdxhc-wrangler-config WRANGLER_LOG_PATH=/tmp/pdxhc-wrangler-logs WRANGLER_SEND_METRICS=false CLOUDFLARE_API_TOKEN="$TOKEN" npx wrangler pages deploy dist --project-name=pdxhc --branch=main
```

7. Verify production.

```bash
curl -sS -I https://pdxhc.org/
curl -sS https://pdxhc.org/api/directory
```

For public profile changes, also check a `/u/<did>` route.
