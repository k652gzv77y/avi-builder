import { NextRequest } from 'next/server';

import { noCache } from '@/lib/api-response';
import {
  getRequestActor,
  probeDomain,
  projectSlugOf,
  workspaceErrorResponse,
} from '@/lib/services/workspaceService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const actor = await getRequestActor();
    if (!actor) return noCache({ error: 'Not authenticated' }, 401);
    const slug = projectSlugOf(request);
    const hostname = request.nextUrl.searchParams.get('hostname') ?? '';
    if (!slug) return noCache({ error: 'Project slug is required' }, 400);
    if (!hostname) return noCache({ error: 'Hostname is required' }, 400);
    const data = await probeDomain(actor, slug, hostname);
    return noCache({ data });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
