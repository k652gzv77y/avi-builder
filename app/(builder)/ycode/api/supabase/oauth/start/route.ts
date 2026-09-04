import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const project = request.nextUrl.searchParams.get('project') || 'unknown';
  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID;
  const redirectUri =
    process.env.SUPABASE_OAUTH_REDIRECT_URI ||
    `${request.nextUrl.origin}/projects/oauth/supabase/callback`;

  if (!clientId) {
    return NextResponse.json({
      error: 'Supabase OAuth is not configured',
      hint: 'Create a Supabase org OAuth app, then set SUPABASE_OAUTH_CLIENT_ID and SUPABASE_OAUTH_CLIENT_SECRET. Redirect URI must be https://avibuilder.com/projects/oauth/supabase/callback',
    }, { status: 501 });
  }

  const url = new URL('https://api.supabase.com/v1/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', project);
  return NextResponse.json({ url: url.toString() });
}
