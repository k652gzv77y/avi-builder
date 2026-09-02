import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase-route-client';

const PROJECTS_ROOT = '/projects';
const DEFAULT_PROJECT_PATH = '/projects/kolbo-school';

function getSafeProjectPath(value: string | null): string {
  if (!value || !value.startsWith('/projects/')) return DEFAULT_PROJECT_PATH;

  const target = new URL(value, 'https://avibuilder.com');
  return target.origin === 'https://avibuilder.com' ? `${target.pathname}${target.search}` : DEFAULT_PROJECT_PATH;
}

/**
 * GET /ycode/api/auth/callback
 *
 * Handle OAuth callback from Supabase Auth
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const projectPath = getSafeProjectPath(requestUrl.searchParams.get('next'));

  if (code) {
    try {
      const supabase = await createRouteClient();

      if (!supabase) {
        return NextResponse.redirect(
          new URL(`${PROJECTS_ROOT}?error=config`, request.url)
        );
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Auth callback error:', error);
        return NextResponse.redirect(
          new URL(`${PROJECTS_ROOT}?error=auth`, request.url)
        );
      }

      return NextResponse.redirect(new URL(projectPath, request.url));
    } catch (error) {
      console.error('Auth callback failed:', error);
      return NextResponse.redirect(
        new URL(`${PROJECTS_ROOT}?error=server`, request.url)
      );
    }
  }

  return NextResponse.redirect(new URL(PROJECTS_ROOT, request.url));
}
