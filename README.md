# Portland Hacker Collective

Landing page for the Portland Hacker Collective, a local directory for hackers and businesses coordinating short-term technical contracts.

## Stack

- Vue on Vite for the frontend.
- Cloudflare Pages for static deploys now.
- `wrangler.jsonc` is present so the project can grow into Pages Functions, Workers bindings, D1, KV, R2, or auth-backed app routes later.

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

Recommended project settings:

- Project name: `pdxhc`
- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`

Direct deploy from this checkout:

```bash
wrangler pages project create pdxhc --production-branch=main --compatibility-date=2026-07-02
npm run deploy
```

Preview the Cloudflare Pages output locally:

```bash
npm run cf:preview
```

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
