'use client';

import { Suspense, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import YCodeBuilder from './components/YCodeBuilderMain';
import ColorTokensStyle from '@/components/ColorTokensStyle';
import AllBreakpointsControl from './components/AllBreakpointsControl';
import { useEditorUrl } from '@/hooks/use-editor-url';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  startLockExpirationCheck,
  stopLockExpirationCheck,
  startNotificationCleanup,
  stopNotificationCleanup,
} from '@/stores/useCollaborationPresenceStore';

function YCodeLayoutInner({ children }: { children: React.ReactNode }) {
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
  const hideCanvasExtras =
    prefixRoutes.some((route) => pathname?.includes(route)) ||
    exactSuffixes.some((route) => pathname?.endsWith(route));

  if (hideCanvasExtras) {
    return (
      <>
        <ColorTokensStyle />
        {children}
      </>
    );
  }

  const showAllControl = routeType === 'layers' || routeType === 'page' || routeType === null;

  if (routeType === 'settings' || routeType === 'localization' || routeType === 'profile' || routeType === 'forms' || routeType === 'integrations') {
    return (
      <>
        <ColorTokensStyle />
        <YCodeBuilder>{children}</YCodeBuilder>
      </>
    );
  }

  return (
    <>
      <ColorTokensStyle />
      {showAllControl && <AllBreakpointsControl />}
      <YCodeBuilder />
    </>
  );
}

export default function YCodeLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <YCodeLayoutInner>{children}</YCodeLayoutInner>
    </Suspense>
  );
}
