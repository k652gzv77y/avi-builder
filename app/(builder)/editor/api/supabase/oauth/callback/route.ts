import { NextRequest, NextResponse } from 'next/server';
import { getWorkerVar } from '@/lib/worker-env';
import { PROJECT_SLUG_HEADER } from '@/lib/project-url';

export const dynamic = 'force-dynamic';

function pickSlug(request: NextRequest): string {
  const state = request.nextUrl.searchParams.get('state') || '';
  const cookieSlug = request.cookies.get('avi_oauth_project')?.value || '';
  const headerSlug = request.headers.get(PROJECT_SLUG_HEADER) || '';
  const candidates = [state, cookieSlug, headerSlug];
  return candidates.find((value) => value && value !== 'unknown' && value !== 'project') || cookieSlug || state || '';
}

export async function GET(request: NextRequest) {
  const project = pickSlug(request);
  const code = request.nextUrl.searchParams.get('code');
  const dest = new URL(
    project ? `/projects/${project}/settings/cms` : '/projects',
    request.nextUrl.origin,
  );

  if (!code) {
    dest.searchParams.set('error', 'denied');
    return NextResponse.redirect(dest);
  }

  const clientId = await getWorkerVar('SUPABASE_OAUTH_CLIENT_ID');
  const clientSecret = await getWorkerVar('SUPABASE_OAUTH_CLIENT_SECRET');
  const redirectUri =
    (await getWorkerVar('SUPABASE_OAUTH_REDIRECT_URI')) ||
    `${request.nextUrl.origin}/projects/oauth/supabase/callback`;

  if (!clientId || !clientSecret) {
    dest.searchParams.set('error', 'not_configured');
    const res = NextResponse.redirect(dest);
    res.cookies.delete('avi_oauth_project');
    return res;
  }

  try {
    const tokenRes = await fetch('https://api.supabase.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) {
      dest.searchParams.set('error', `token_${tokenRes.status}`);
    } else {
      dest.searchParams.set('supabase', 'connected');
    }
  } catch {
    dest.searchParams.set('error', 'token');
  }

  const res = NextResponse.redirect(dest);
  res.cookies.delete('avi_oauth_project');
  return res;
}
