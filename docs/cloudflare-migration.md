# Cloudflare Migration

AVI Builder uses OpenNext on Cloudflare Workers. Vercel remains the production
rollback target until the staging Worker passes the verification checklist.

## One-time Cloudflare setup

1. Create a Cloudflare KV namespace named `avi-builder-opennext-cache` and
   bind it as `NEXT_INC_CACHE_KV`.
2. Create a Hyperdrive configuration for the existing AVI Builder Supabase
   Postgres database. Use the pooled Postgres connection string.
3. Add the returned Hyperdrive id to `wrangler.jsonc`:

```jsonc
"hyperdrive": [
  { "binding": "HYPERDRIVE", "id": "<hyperdrive-id>" }
]
```

4. Enable Cloudflare Images for the account. The Worker uses the `IMAGES`
   binding for uploads, avatars, component thumbnails, and responsive assets.
5. Add the existing runtime secrets with `wrangler secret put`; do not place
   Supabase secret keys, database passwords, AI keys, OAuth secrets, or cron
   secrets in `wrangler.jsonc`.
6. Workers Builds is connected to the `avi-builder` Worker, so the `name`
   field in `wrangler.jsonc` must stay `avi-builder`. Leave `avibuilder.com`
   on Vercel until the Worker is verified.

The first deployment creates the `DOShardedTagCache` Durable Object declared in
`wrangler.jsonc`. Do not remove its migration entry after deployment: it holds
the shared Next.js tag invalidation state used by publish and revalidate.

## Commands

```bash
npm run build:worker
npm run preview:worker
npm run deploy:worker
```

Workers Builds often runs `npx wrangler deploy` (or `versions upload`) on
preview branches without a prior OpenNext build. The `@opennextjs/cloudflare`
patch makes `deploy` and `upload` build the worker when `.open-next` is missing.

Before the first deploy, add the Hyperdrive binding id and use the actual
Cloudflare account in Wrangler. The dashboard Worker and `wrangler.jsonc`
`name` must both be `avi-builder` or Workers Builds fails before compile.

## Required validation before DNS cutover

- Sign in, open the editor, and save an edit.
- Publish and verify public pages, dynamic CMS pages, redirects, and preview.
- Verify file uploads and image optimization.
- Exercise MCP OAuth/token endpoints and a builder API request.
- Confirm the Airtable cron succeeds and inspect Workers logs.
- Publish then reload a public page to confirm tag revalidation reaches the KV
  data cache and Durable Object tag cache.
- Keep Vercel serving production until all checks pass on staging.
