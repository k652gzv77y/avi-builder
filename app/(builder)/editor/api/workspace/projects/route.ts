import { NextRequest } from 'next/server';

import { noCache } from '@/lib/api-response';
import { addProject, getRequestActor, workspaceErrorResponse } from '@/lib/services/workspaceService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const actor = await getRequestActor();
    if (!actor) return noCache({ error: 'Not authenticated' }, 401);
    const body = await request.json().catch(() => ({})) as { accountId?: string; name?: string };
    if (!body.accountId) return noCache({ error: 'Account is required' }, 400);
    const data = await addProject(actor, body.accountId, body.name ?? '');
    return noCache({ data }, 201);
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
