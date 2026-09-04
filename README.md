# Avi Builder

Avi Builder is AviCorp’s visual website builder and CMS. The first-pass goal is Framer editor parity (freeform canvas, breakpoints, designer tools), hosted on Cloudflare Workers.

## Product URLs

- Builder: https://avibuilder.com
- Source: https://github.com/k652gzv77y/avi-builder

## Development

Requirements:

- Node.js 18 or later
- Supabase project
- Cloudflare Workers account for production

Install and run locally:

```bash
npm install
npm run dev
```

Copy the required Supabase, AI, and template-service variables into `.env.local` before using the builder. Production variables are configured on the `avi-builder` Cloudflare Worker.

The editor public path is `/editor`. Requests to `/ycode` redirect there.

## Licensing

This repository includes modified MIT-licensed source. Copyright notices are preserved in [LICENSE](LICENSE) and [NOTICE](NOTICE) as required by that license.
