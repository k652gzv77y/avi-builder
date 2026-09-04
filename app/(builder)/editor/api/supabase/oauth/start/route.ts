import { NextRequest, NextResponse } from 'next/server';
import { getWorkerVar } from '@/lib/worker-env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const project = request.nextUrl.searchParams.get('project') || 'unknown';
  const clientId = await getWorkerVar('SUPABASE_OAUTH_CLIENT_ID');
  const redirectUri =
    (await getWorkerVar('SUPABASE_OAUTH_REDIRECT_URI')) ||
    `${request.nextUrl.origin}/projects/oauth/supabase/callback`;

  if (!clientId) {
    return NextResponse.json({
      error: 'Supabase OAuth is not configured',
      hint: 'SUPABASE_OAUTH_CLIENT_ID is not visible to the Worker runtime yet.',
    }, { status: 501 });
  }

  const url = new URL('https://api.supabase.com/v1/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', project);
  return NextResponse.json({ url: url.toString() });
}
