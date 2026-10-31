import { NextRequest } from 'next/server';

import { noCache } from '@/lib/api-response';
import { addAccount, getRequestActor, workspaceErrorResponse } from '@/lib/services/workspaceService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const actor = await getRequestActor();
    if (!actor) return noCache({ error: 'Not authenticated' }, 401);
    const body = await request.json().catch(() => ({})) as { name?: string };
    const data = await addAccount(actor, body.name ?? '');
    return noCache({ data }, 201);
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
