import { NextRequest } from 'next/server';

import { noCache } from '@/lib/api-response';
import { addBranch, getRequestActor, getWorkspaceOverview, workspaceErrorResponse } from '@/lib/services/workspaceService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const actor = await getRequestActor();
    if (!actor) return noCache({ error: 'Not authenticated' }, 401);
    const { slug } = await params;
    const overview = await getWorkspaceOverview(actor);
    const project = overview.projects.find((entry) => entry.slug === slug);
    if (!project) return noCache({ error: 'Project not found' }, 404);
    return noCache({
      data: {
        contentMode: project.contentMode,
        canEdit: project.canEdit,
        branches: project.branches,
      },
    });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const actor = await getRequestActor();
    if (!actor) return noCache({ error: 'Not authenticated' }, 401);
    const { slug } = await params;
    const body = await request.json().catch(() => ({})) as { name?: string };
    const data = await addBranch(actor, slug, body.name ?? '');
    return noCache({ data }, 201);
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
