import { NextRequest, NextResponse } from 'next/server';
import { getWorkerVar } from '@/lib/worker-env';

export const dynamic = 'force-dynamic';

const CLOUDFLARE_SCOPES = [
  'dns.read',
  'dns.write',
  'zone.read',
  'zone-settings.read',
  'account-settings.read',
  'user-details.read',
].join(' ');

export async function GET(request: NextRequest) {
  const project = request.nextUrl.searchParams.get('project') || 'unknown';
  const clientId = await getWorkerVar('CLOUDFLARE_OAUTH_CLIENT_ID');
  const redirectUri =
    (await getWorkerVar('CLOUDFLARE_OAUTH_REDIRECT_URI')) ||
    `${request.nextUrl.origin}/projects/oauth/cloudflare/callback`;

  if (!clientId) {
    return NextResponse.json({
      error: 'Cloudflare OAuth is not configured',
      hint: 'CLOUDFLARE_OAUTH_CLIENT_ID is not visible to the Worker runtime yet.',
    }, { status: 501 });
  }

  const url = new URL('https://dash.cloudflare.com/oauth2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', CLOUDFLARE_SCOPES);
  url.searchParams.set('state', project);
  return NextResponse.json({ url: url.toString() });
}
