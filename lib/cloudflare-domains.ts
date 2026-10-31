/**
 * Cloudflare custom-hostname hook.
 *
 * Attaching a domain in Avi stores it immediately. Creating the hostname in
 * Cloudflare only runs when both env vars below are present. Until Seth adds
 * them, the UI shows the DNS checklist and SSL stays pending.
 *
 * TODO(Seth):
 * 1. Create an API token with Zone → SSL and Certificates → Edit and
 *    Zone → Custom Hostnames → Edit. Set CLOUDFLARE_API_TOKEN on the
 *    avi-builder-staging worker (and production, if that worker is separate).
 * 2. Set CLOUDFLARE_ZONE_ID to the zone that owns the fallback origin
 *    (avibuilder.com). Enable SSL for SaaS / Custom Hostnames on that zone.
 * 3. Add Worker routes for sites.avibuilder.com and for
 *    *--*.avibuilder.com so branch preview hosts and customer CNAMEs reach
 *    the OpenNext worker. Apex records need CNAME flattening to
 *    sites.avibuilder.com.
 * 4. The existing Cloudflare OAuth client only starts the consent redirect.
 *    It does not exchange a token (no client secret is stored). Domain
 *    writes use CLOUDFLARE_API_TOKEN, not that OAuth grant.
 */

import { getWorkerVar } from '@/lib/worker-env';
import { CUSTOM_DOMAIN_CNAME_TARGET } from '@/lib/domain-routing';

export const CLOUDFLARE_API_TOKEN_ENV = 'CLOUDFLARE_API_TOKEN';
export const CLOUDFLARE_ZONE_ID_ENV = 'CLOUDFLARE_ZONE_ID';
export { CLOUDFLARE_DOMAIN_STEPS } from '@/lib/domain-routing';

export interface CloudflareDomainPlan {
  hostname: string;
  cnameTarget: string;
  missing: string[];
  ready: boolean;
}

export interface CloudflareHostnameResult {
  attempted: boolean;
  ok: boolean;
  missing: string[];
  detail: string;
}

export function planCustomDomain(
  hostname: string,
  env: { apiToken?: string; zoneId?: string },
): CloudflareDomainPlan {
  const missing: string[] = [];
  if (!env.apiToken) missing.push(CLOUDFLARE_API_TOKEN_ENV);
  if (!env.zoneId) missing.push(CLOUDFLARE_ZONE_ID_ENV);
  return {
    hostname,
    cnameTarget: CUSTOM_DOMAIN_CNAME_TARGET,
    missing,
    ready: missing.length === 0,
  };
}

export async function ensureCustomHostname(hostname: string): Promise<CloudflareHostnameResult> {
  const apiToken = await getWorkerVar(CLOUDFLARE_API_TOKEN_ENV);
  const zoneId = await getWorkerVar(CLOUDFLARE_ZONE_ID_ENV);
  const plan = planCustomDomain(hostname, { apiToken, zoneId });
  if (!plan.ready || !apiToken || !zoneId) {
    return {
      attempted: false,
      ok: false,
      missing: plan.missing,
      detail: 'Cloudflare credentials are not on the worker yet. Use the DNS checklist.',
    };
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hostname,
          ssl: { method: 'http', type: 'dv' },
        }),
      },
    );
    const payload = await response.json().catch(() => ({})) as { success?: boolean; errors?: { message?: string }[] };
    if (!response.ok || payload.success === false) {
      const detail = payload.errors?.[0]?.message || `Cloudflare returned ${response.status}`;
      return { attempted: true, ok: false, missing: [], detail };
    }
    return { attempted: true, ok: true, missing: [], detail: 'Custom hostname requested.' };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Cloudflare request failed';
    return { attempted: true, ok: false, missing: [], detail };
  }
}
