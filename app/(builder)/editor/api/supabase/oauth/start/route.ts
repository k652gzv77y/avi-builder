import { NextRequest, NextResponse } from 'next/server';
import { getWorkerVar } from '@/lib/worker-env';
import { PROJECT_SLUG_HEADER } from '@/lib/project-url';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const headerSlug = request.headers.get(PROJECT_SLUG_HEADER) || '';
  const project =
    request.nextUrl.searchParams.get('project') ||
    headerSlug ||
    'unknown';
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

  const res = NextResponse.json({ url: url.toString() });
  if (project && project !== 'unknown') {
    res.cookies.set('avi_oauth_project', project, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
  }
  return res;
}
