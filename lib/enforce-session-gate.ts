/**
 * Server redirect for pages that require a Supabase session.
 *
 * Kept out of lib/route-protection.ts so the canvas (a client component)
 * can use the pure helpers without pulling next/headers, server-only, or fs
 * into the browser bundle.
 */

import 'server-only';

import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/supabase-auth';
import { sessionGate } from '@/lib/route-protection';
import type { Page } from '@/types';

/**
 * Redirect anonymous visitors when the page requires a Supabase session.
 * Uses the cookie session client, which is the same client RLS sees.
 */
export async function enforceSessionGate(
  page: Pick<Page, 'settings'>,
  currentPath: string,
): Promise<void> {
  const decision = sessionGate(page, currentPath);
  if (!decision.redirect) return;

  await connection();

  const auth = await getAuthUser();
  if (auth) return;

  redirect(decision.location);
}
