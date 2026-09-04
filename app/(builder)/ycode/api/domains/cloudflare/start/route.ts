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

function base64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function createPkce() {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64Url(verifierBytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64Url(new Uint8Array(digest));
  return { verifier, challenge };
}

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

  const { verifier, challenge } = await createPkce();
  const url = new URL('https://dash.cloudflare.com/oauth2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', CLOUDFLARE_SCOPES);
  url.searchParams.set('state', project);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  const res = NextResponse.json({ url: url.toString() });
  res.cookies.set('avi_cf_pkce', verifier, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
