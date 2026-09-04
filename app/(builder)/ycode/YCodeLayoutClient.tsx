'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import YCodeEditorShell from './YCodeEditorShell';

function isLightRoute(pathname: string | null) {
  if (!pathname) return false;
  return (
    pathname.includes('/settings') ||
    pathname.includes('/preview') ||
    pathname.includes('/devtools/') ||
    pathname.includes('/oauth/') ||
    pathname.endsWith('/welcome') ||
    pathname.endsWith('/accept-invite')
  );
}

function YCodeLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isLightRoute(pathname)) {
    return <>{children}</>;
  }
  return <YCodeEditorShell>{children}</YCodeEditorShell>;
}

export default function YCodeLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <YCodeLayoutInner>{children}</YCodeLayoutInner>
    </Suspense>
  );
}
