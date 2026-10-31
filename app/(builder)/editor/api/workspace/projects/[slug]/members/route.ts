import { NextRequest } from 'next/server';

import { noCache } from '@/lib/api-response';
import { getRequestActor, inviteMember, workspaceErrorResponse } from '@/lib/services/workspaceService';
import type { AccountRole } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const actor = await getRequestActor();
    if (!actor) return noCache({ error: 'Not authenticated' }, 401);
    const { slug } = await params;
    const body = await request.json().catch(() => ({})) as {
      email?: string;
      role?: AccountRole;
      redirectTo?: string;
    };
    const result = await inviteMember(
      actor,
      slug,
      body.email ?? '',
      body.role ?? 'editor',
      body.redirectTo,
    );
    return noCache({
      data: result.overview,
      message: result.message,
      invited: result.invited,
    });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
