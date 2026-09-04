'use client';
import { projectsPath } from '@/lib/project-url';

/**
 * Devtools Layout
 *
 * Requires authentication for all /projects/:slug/devtools/* pages.
 * Redirects to /projects/:slug if not authenticated.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/hooks/use-auth-session';
import BuilderLoading from '@/components/BuilderLoading';

export default function DevtoolsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, isLoading } = useAuthSession();

  useEffect(() => {
    if (!isLoading && !session) {
      router.push(projectsPath(''));
    }
  }, [isLoading, session, router]);

  if (isLoading || !session) {
    return <BuilderLoading message="Checking setup" />;
  }

  return <>{children}</>;
}
