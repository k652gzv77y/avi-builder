import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import kvIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache';
import doShardedTagCache from '@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache';

/**
 * OpenNext uses this Cloudflare KV-backed cache for Next.js `unstable_cache`,
 * `revalidateTag`, and ISR data. The Worker binding lives in wrangler.jsonc.
 */
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  tagCache: doShardedTagCache({ baseShardSize: 4 }),
});
