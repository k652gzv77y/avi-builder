'use client';

import { Suspense, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import BuilderApp from './components/BuilderMain';
import ColorTokensStyle from '@/components/ColorTokensStyle';
import { useEditorUrl } from '@/hooks/use-editor-url';
import { rememberProjectSlug } from '@/lib/project-url';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  startLockExpirationCheck,
  stopLockExpirationCheck,
  startNotificationCleanup,
  stopNotificationCleanup,
} from '@/stores/useCollaborationPresenceStore';

function BuilderLayoutInner({
  children,
  initialSlug,
}: {
  children: React.ReactNode;
  initialSlug?: string | null;
}) {
  rememberProjectSlug(initialSlug);
  const pathname = usePathname();
  const { routeType } = useEditorUrl();
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    startLockExpirationCheck();
    startNotificationCleanup();
    return () => {
      stopLockExpirationCheck();
      stopNotificationCleanup();
    };
  }, []);

  const prefixRoutes = ['/preview', '/devtools/', '/oauth/'];
  const exactSuffixes = ['/welcome', '/accept-invite'];
  if (
    prefixRoutes.some((route) => pathname?.includes(route)) ||
    exactSuffixes.some((route) => pathname?.endsWith(route))
  ) {
    return (
      <>
        <ColorTokensStyle />
        {children}
      </>
    );
  }

  if (routeType === 'settings' || routeType === 'localization' || routeType === 'profile' || routeType === 'forms' || routeType === 'integrations') {
    return (
      <>
        <ColorTokensStyle />
        <BuilderApp>{children}</BuilderApp>
      </>
    );
  }

  return (
    <>
      <ColorTokensStyle />
      <BuilderApp />
    </>
  );
}

export default function BuilderLayoutClient({
  children,
  initialSlug,
}: {
  children: React.ReactNode;
  initialSlug?: string | null;
}) {
  rememberProjectSlug(initialSlug);
  return (
    <Suspense fallback={null}>
      <BuilderLayoutInner initialSlug={initialSlug}>{children}</BuilderLayoutInner>
    </Suspense>
  );
}
