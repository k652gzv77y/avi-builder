'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useEditorUrl } from '@/hooks/use-editor-url';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  startLockExpirationCheck,
  stopLockExpirationCheck,
  startNotificationCleanup,
  stopNotificationCleanup,
} from '@/stores/useCollaborationPresenceStore';

const YCodeBuilder = dynamic(() => import('./components/YCodeBuilderMain'), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
      Loading canvas…
    </div>
  ),
});

export default function YCodeEditorShell({ children }: { children: React.ReactNode }) {
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

  if (routeType === 'localization' || routeType === 'profile' || routeType === 'forms' || routeType === 'integrations') {
    return <YCodeBuilder>{children}</YCodeBuilder>;
  }

  return <YCodeBuilder />;
}
