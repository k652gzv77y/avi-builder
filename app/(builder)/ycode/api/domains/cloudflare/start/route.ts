import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const project = request.nextUrl.searchParams.get('project') || 'unknown';
  const clientId = process.env.CLOUDFLARE_OAUTH_CLIENT_ID;
  const redirectUri =
    process.env.CLOUDFLARE_OAUTH_REDIRECT_URI ||
    `${request.nextUrl.origin}/projects/oauth/cloudflare/callback`;

  if (!clientId) {
    return NextResponse.json({
      error: 'Cloudflare OAuth is not configured',
      hint: 'Create a Cloudflare OAuth app, then set CLOUDFLARE_OAUTH_CLIENT_ID and CLOUDFLARE_OAUTH_CLIENT_SECRET. Redirect URI must be https://avibuilder.com/projects/oauth/cloudflare/callback',
    }, { status: 501 });
  }

  const url = new URL('https://dash.cloudflare.com/oauth2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', project);
  return NextResponse.json({ url: url.toString() });
}
