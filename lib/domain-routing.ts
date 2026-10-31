/**
 * Host routing for branch previews and custom domains.
 *
 * Pure helpers. The worker (proxy.ts) applies them. Live DNS still needs a
 * Cloudflare token, zone id, and routes — see lib/cloudflare-domains.ts.
 */

import { isReservedProjectSlug } from '@/lib/project-url';

export const BUILDER_HOST = 'avibuilder.com';

/** CNAME target Seth still needs to attach as a Worker route. */
export const CUSTOM_DOMAIN_CNAME_TARGET = 'sites.avibuilder.com';

export const CLOUDFLARE_DOMAIN_STEPS = [
  'Set CLOUDFLARE_API_TOKEN on avi-builder-staging (Zone SSL Edit and Custom Hostnames Edit).',
  'Set CLOUDFLARE_ZONE_ID to the avibuilder.com zone and enable SSL for SaaS.',
  'Add Worker routes for sites.avibuilder.com and *--*.avibuilder.com so CNAMEs and branch previews reach the worker.',
  'Point apex and www at sites.avibuilder.com. Apex needs CNAME flattening. www↔apex redirects run once the hostname hits the worker.',
];

export const BRANCH_HEADER = 'x-avi-branch';

export type DomainKind = 'apex' | 'www' | 'subdomain';
export type DomainRedirect = 'none' | 'apex-to-www' | 'www-to-apex';
export type DomainStatus = 'pending' | 'live' | 'error';
export type SslStatus = 'pending' | 'active' | 'error';

export interface DnsRecord {
  type: 'CNAME' | 'TXT';
  host: string;
  value: string;
  purpose: string;
}

export interface RoutableDomain {
  hostname: string;
  projectSlug: string;
  redirect: DomainRedirect;
  disconnectedAt: string | null;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSlug(value: string): boolean {
  return SLUG.test(value);
}

export function normalizeHostname(input: string): string {
  let host = input.trim().toLowerCase();
  host = host.replace(/^https?:\/\//, '');
  host = host.split('/')[0] ?? '';
  host = host.split(':')[0] ?? '';
  if (host.endsWith('.')) host = host.slice(0, -1);
  return host;
}

export function classifyHostname(hostname: string): DomainKind {
  if (hostname.startsWith('www.')) return 'www';
  const labels = hostname.split('.');
  if (labels.length <= 2) return 'apex';
  return 'subdomain';
}

export function isAttachableHostname(input: string): boolean {
  const host = normalizeHostname(input);
  if (!host || host.length > 253 || host.includes('..')) return false;
  if (!/^[a-z0-9.-]+$/.test(host)) return false;
  if (!host.includes('.')) return false;
  if (host === BUILDER_HOST || host === `www.${BUILDER_HOST}`) return false;
  if (host.endsWith(`.${BUILDER_HOST}`)) return false;
  if (parsePreviewHostname(host)) return false;
  return true;
}

/**
 * Branch preview host: `{branch}--{project}.avibuilder.com`.
 * The double hyphen keeps a single-hyphen project slug intact.
 */
export function parsePreviewHostname(hostname: string): { branch: string; project: string } | null {
  const host = normalizeHostname(hostname);
  const suffix = `.${BUILDER_HOST}`;
  if (!host.endsWith(suffix)) return null;
  const label = host.slice(0, -suffix.length);
  const parts = label.split('--');
  if (parts.length !== 2) return null;
  const [branch, project] = parts;
  if (!branch || !project) return null;
  if (!isSlug(branch) || !isSlug(project)) return null;
  if (isReservedProjectSlug(project)) return null;
  return { branch, project };
}

export function previewHostname(branch: string, project: string): string {
  return `${branch}--${project}.${BUILDER_HOST}`;
}

export function previewPath(project: string, branch: string): string {
  return `/projects/${project}/preview?branch=${encodeURIComponent(branch)}`;
}

export function dnsChecklist(hostname: string, kind: DomainKind): DnsRecord[] {
  const host = normalizeHostname(hostname);
  const cnameHost = kind === 'apex' ? '@' : host.split('.')[0] || host;
  const records: DnsRecord[] = [
    {
      type: 'CNAME',
      host: cnameHost,
      value: CUSTOM_DOMAIN_CNAME_TARGET,
      purpose: kind === 'apex'
        ? 'Point the apex at the worker. Cloudflare flattens this CNAME; other DNS providers need an ALIAS or ANAME.'
        : 'Point this host at the worker.',
    },
    {
      type: 'TXT',
      host: kind === 'apex' ? '_avi-verify' : `_avi-verify.${cnameHost}`,
      value: `avi-project=${host}`,
      purpose: 'Optional ownership check once CLOUDFLARE_API_TOKEN is set.',
    },
  ];
  return records;
}

/** Origin to redirect to, or null when this host should be served. */
export function redirectLocation(hostname: string, domains: RoutableDomain[]): string | null {
  const host = normalizeHostname(hostname);
  const domain = domains.find((entry) => entry.hostname === host && !entry.disconnectedAt);
  if (!domain || domain.redirect === 'none') return null;

  let target = '';
  if (domain.redirect === 'www-to-apex' && host.startsWith('www.')) {
    target = host.slice(4);
  } else if (domain.redirect === 'apex-to-www' && !host.startsWith('www.')) {
    target = `www.${host}`;
  }
  if (!target || target === host) return null;
  return `https://${target}`;
}

export function projectSlugForHostname(hostname: string, domains: RoutableDomain[]): string | null {
  const host = normalizeHostname(hostname);
  const domain = domains.find((entry) => entry.hostname === host && !entry.disconnectedAt);
  return domain?.projectSlug ?? null;
}

export function interpretProbeResponse(status: number): { status: DomainStatus; sslStatus: SslStatus } {
  if (status >= 500) return { status: 'pending', sslStatus: 'active' };
  return { status: 'live', sslStatus: 'active' };
}

export function interpretProbeError(message: string): { status: DomainStatus; sslStatus: SslStatus } {
  if (/cert|ssl|tls|unable to verify/i.test(message)) {
    return { status: 'error', sslStatus: 'error' };
  }
  return { status: 'pending', sslStatus: 'pending' };
}
