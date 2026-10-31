import { NextRequest } from 'next/server';

import { noCache } from '@/lib/api-response';
import { changeProject, getRequestActor, workspaceErrorResponse } from '@/lib/services/workspaceService';
import type { ProjectStatus } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const actor = await getRequestActor();
    if (!actor) return noCache({ error: 'Not authenticated' }, 401);
    const { slug } = await params;
    const body = await request.json().catch(() => ({})) as { name?: string; status?: ProjectStatus };
    if (body.status && body.status !== 'active' && body.status !== 'archived') {
      return noCache({ error: 'Unknown project status' }, 400);
    }
    const data = await changeProject(actor, slug, { name: body.name, status: body.status });
    return noCache({ data });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
