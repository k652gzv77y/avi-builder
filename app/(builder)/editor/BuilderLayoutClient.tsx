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
import './login-theme.css';

function applyBuilderTheme() {
  if (typeof document === 'undefined') return;
  const stored = localStorage.getItem('theme') || 'system';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = stored === 'dark' || (stored !== 'light' && prefersDark);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  root.style.background = dark ? '#0a0a0a' : '#f4f4f5';
}

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
    applyBuilderTheme();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyBuilderTheme();
    media.addEventListener('change', onChange);
    window.addEventListener('storage', onChange);
    const observer = new MutationObserver(() => {
      const stored = localStorage.getItem('theme') || 'system';
      const wantsDark = stored === 'dark' || (stored !== 'light' && media.matches);
      if (document.documentElement.classList.contains('dark') !== wantsDark) {
        applyBuilderTheme();
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      media.removeEventListener('change', onChange);
      window.removeEventListener('storage', onChange);
      observer.disconnect();
    };
  }, []);

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
