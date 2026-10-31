import { NextRequest } from 'next/server';

import { noCache } from '@/lib/api-response';
import { getRequestActor, promoteBranchForActor, workspaceErrorResponse } from '@/lib/services/workspaceService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Stamp a branch as promoted to production.
 * Metadata projects stop here so they do not publish the shared live canvas.
 * The shared project still runs the existing publish route, which stamps too.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; branch: string }> },
) {
  try {
    const actor = await getRequestActor();
    if (!actor) return noCache({ error: 'Not authenticated' }, 401);
    const { slug, branch } = await params;
    const data = await promoteBranchForActor(actor, slug, branch);
    return noCache({ data, message: 'Branch promoted to production' });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
