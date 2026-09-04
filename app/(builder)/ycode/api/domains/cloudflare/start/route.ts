import { NextRequest, NextResponse } from 'next/server';

/**
 * Starts Cloudflare OAuth so a *project owner* can attach a zone they control.
 * Avi's own Cloudflare account is not enough — Kolbo on the same login is a coincidence.
 */
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId');
  const clientId = process.env.CLOUDFLARE_OAUTH_CLIENT_ID;
  const redirectUri =
    process.env.CLOUDFLARE_OAUTH_REDIRECT_URI ||
    `${request.nextUrl.origin}/ycode/api/domains/cloudflare/callback`;

  if (!clientId) {
    return NextResponse.json({
      error: 'Cloudflare OAuth is not configured',
      hint: 'Create a Cloudflare OAuth app with account:read and zone:edit, then set CLOUDFLARE_OAUTH_CLIENT_ID and CLOUDFLARE_OAUTH_CLIENT_SECRET on the Worker. After callback we list zones, the user picks one, and Avi writes CNAME + custom hostname records for production, staging, and branch hosts.',
      projectId,
    }, { status: 501 });
  }

  const url = new URL('https://dash.cloudflare.com/oauth2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'account:read zone:read zone:edit');
  url.searchParams.set('state', projectId || '');
  return NextResponse.json({ url: url.toString() });
}
