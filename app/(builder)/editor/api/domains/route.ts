import { NextRequest } from 'next/server';

import { noCache } from '@/lib/api-response';
import type { DomainRedirect } from '@/lib/domain-routing';
import {
  addDomain,
  changeDomainRedirect,
  getRequestActor,
  getWorkspaceOverview,
  projectSlugOf,
  removeDomain,
  workspaceErrorResponse,
} from '@/lib/services/workspaceService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function requireSlug(request: NextRequest) {
  const slug = projectSlugOf(request);
  if (!slug) return null;
  return slug;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getRequestActor();
    if (!actor) return noCache({ error: 'Not authenticated' }, 401);
    const slug = requireSlug(request);
    if (!slug) return noCache({ error: 'Project slug is required' }, 400);
    const overview = await getWorkspaceOverview(actor);
    const project = overview.projects.find((entry) => entry.slug === slug);
    if (!project) return noCache({ error: 'Project not found' }, 404);
    return noCache({ data: project.domains });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getRequestActor();
    if (!actor) return noCache({ error: 'Not authenticated' }, 401);
    const slug = requireSlug(request);
    if (!slug) return noCache({ error: 'Project slug is required' }, 400);
    const body = await request.json().catch(() => ({})) as { hostname?: string; redirect?: DomainRedirect };
    if (!body.hostname) return noCache({ error: 'Hostname is required' }, 400);
    const result = await addDomain(actor, slug, body.hostname, body.redirect);
    return noCache({
      data: result.domain,
      cloudflare: result.cloudflare,
    }, 201);
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await getRequestActor();
    if (!actor) return noCache({ error: 'Not authenticated' }, 401);
    const slug = requireSlug(request);
    if (!slug) return noCache({ error: 'Project slug is required' }, 400);
    const body = await request.json().catch(() => ({})) as { hostname?: string; redirect?: DomainRedirect };
    if (!body.hostname || !body.redirect) return noCache({ error: 'Hostname and redirect are required' }, 400);
    const overview = await changeDomainRedirect(actor, slug, body.hostname, body.redirect);
    const domains = overview.projects.find((entry) => entry.slug === slug)?.domains ?? [];
    return noCache({ data: domains });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await getRequestActor();
    if (!actor) return noCache({ error: 'Not authenticated' }, 401);
    const slug = requireSlug(request);
    if (!slug) return noCache({ error: 'Project slug is required' }, 400);
    const hostname = request.nextUrl.searchParams.get('hostname') ?? '';
    if (!hostname) return noCache({ error: 'Hostname is required' }, 400);
    const overview = await removeDomain(actor, slug, hostname);
    const domains = overview.projects.find((entry) => entry.slug === slug)?.domains ?? [];
    return noCache({ data: domains });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
