/**
 * Hosting-runtime helpers.
 *
 * The builder runs locally, on Vercel during the transition, and on Cloudflare
 * Workers after cutover. Keep platform-specific lifecycle calls here so route
 * and cache code does not need to know which host is serving it.
 */

export function isCloudflareRuntime(): boolean {
  return process.env.AVI_RUNTIME === 'cloudflare';
}

export function isHostedRuntime(): boolean {
  return isCloudflareRuntime() || process.env.VERCEL === '1';
}

/** Schedule best-effort work without delaying the request response. */
export async function runInBackground(task: Promise<unknown>): Promise<void> {
  if (isCloudflareRuntime()) {
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      getCloudflareContext().ctx.waitUntil(task);
      return;
    } catch (error) {
      console.warn('[Runtime] Could not schedule Cloudflare background work:', error);
    }
  }

  after(() => task);
}
import { after } from 'next/server';
