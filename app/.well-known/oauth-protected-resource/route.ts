import type { NextRequest } from 'next/server';
import { getProjectSlugFromHeaders, getProjectSlugFromPath, projectsPath } from '@/lib/project-url';
import { getBaseUrl, jsonMetadataResponse, optionsResponse } from '@/lib/oauth/metadata';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function resolveMcpResource(request: NextRequest, baseUrl: string): string {
  try {
    return `${baseUrl}${projectsPath('/mcp', request.headers)}`;
  } catch {
    const referer = request.headers.get('referer');
    if (referer) {
      try {
        const slug = getProjectSlugFromPath(new URL(referer).pathname);
        if (slug) return `${baseUrl}/projects/${slug}/mcp`;
      } catch {
        // ignore
      }
    }
    const headerSlug = getProjectSlugFromHeaders(request.headers);
    if (headerSlug) return `${baseUrl}/projects/${headerSlug}/mcp`;
    return `${baseUrl}/projects`;
  }
}

/**
 * RFC 9728 — Protected Resource Metadata.
 *
 * Tells OAuth-aware MCP clients which authorization server protects this
 * deployment. Returned URL is absolute so it works behind reverse proxies
 * and on any host (Vercel preview, custom domain, localhost).
 */
export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);

  return jsonMetadataResponse({
    resource: resolveMcpResource(request, baseUrl),
    authorization_servers: [baseUrl],
    bearer_methods_supported: ['header'],
    resource_documentation: 'https://github.com/k652gzv77y/avi-builder',
  });
}

export async function OPTIONS() {
  return optionsResponse();
}
