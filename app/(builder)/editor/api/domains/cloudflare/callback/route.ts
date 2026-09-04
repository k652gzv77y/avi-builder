import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const project = request.nextUrl.searchParams.get('state') || '';
  const code = request.nextUrl.searchParams.get('code');
  const dest = new URL(`/projects/${project || 'project'}/settings/domains`, request.nextUrl.origin);
  dest.searchParams.set(code ? 'cloudflare' : 'error', code ? 'connected' : 'denied');
  return NextResponse.redirect(dest);
}
