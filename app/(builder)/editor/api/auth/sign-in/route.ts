import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase-route-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /projects/:slug/api/auth/sign-in
 *
 * Password sign-in for published pages. Sets the Supabase session cookie
 * through the route client so protected routes and collection writes see
 * the same user.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 },
      );
    }

    const client = await createRouteClient();
    if (!client) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 },
      );
    }

    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ data: { signedIn: true } });
  } catch (error) {
    console.error('Sign-in failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sign in' },
      { status: 500 },
    );
  }
}
