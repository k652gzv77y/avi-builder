import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID;
  const redirectUri =
    process.env.SUPABASE_OAUTH_REDIRECT_URI ||
    `${request.nextUrl.origin}/projects/kolbo-school/api/supabase/oauth/callback`;

  if (!clientId) {
    return NextResponse.json({
      error: 'Supabase OAuth is not configured',
      hint: 'Create a Supabase integration (OAuth) and set SUPABASE_OAUTH_CLIENT_ID and SUPABASE_OAUTH_CLIENT_SECRET. After login the user picks a project for CMS data.',
    }, { status: 501 });
  }

  const url = new URL('https://api.supabase.com/v1/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'projects:read');
  return NextResponse.json({ url: url.toString() });
}
