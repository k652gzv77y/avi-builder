import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.CLOUDFLARE_OAUTH_CLIENT_ID;
  const redirectUri =
    process.env.CLOUDFLARE_OAUTH_REDIRECT_URI ||
    `${request.nextUrl.origin}/projects/kolbo-school/api/domains/cloudflare/callback`;

  if (!clientId) {
    return NextResponse.json({
      error: 'Cloudflare OAuth is not configured',
      hint: 'Create a Cloudflare OAuth app with zone:read and zone:edit, then set CLOUDFLARE_OAUTH_CLIENT_ID and CLOUDFLARE_OAUTH_CLIENT_SECRET on the Worker.',
    }, { status: 501 });
  }

  const url = new URL('https://dash.cloudflare.com/oauth2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'account:read zone:read zone:edit');
  return NextResponse.json({ url: url.toString() });
}
