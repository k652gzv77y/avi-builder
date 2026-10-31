import { getRequestActor, getWorkspaceOverview, workspaceErrorResponse } from '@/lib/services/workspaceService';
import { noCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const actor = await getRequestActor();
    if (!actor) return noCache({ error: 'Not authenticated' }, 401);
    const data = await getWorkspaceOverview(actor);
    return noCache({ data });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
