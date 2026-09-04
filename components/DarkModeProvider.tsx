'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

function isBuilderHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'avibuilder.com' || host === 'www.avibuilder.com';
}

function shouldApplyDark(): boolean {
  const saved = localStorage.getItem('theme') as 'system' | 'light' | 'dark' | null;
  const theme = saved || 'system';
  if (theme === 'light') return false;
  if (theme === 'dark') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyClass(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.classList.toggle('light', !dark);
}

export default function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const apply = () => {
      const onBuilder = isBuilderHost();
      const isPreviewRoute = pathname?.includes('/preview');
      const isBuilderRoute = onBuilder && !isPreviewRoute && (pathname === '/projects' || pathname?.startsWith('/projects'));
      if (isBuilderRoute || !onBuilder) {
        applyClass(isBuilderRoute ? shouldApplyDark() : window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    };

    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply();
    mq.addEventListener('change', onChange);
    window.addEventListener('storage', onChange);
    window.addEventListener('avi-theme-change', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
      window.removeEventListener('storage', onChange);
      window.removeEventListener('avi-theme-change', onChange);
    };
  }, [pathname]);

  return <>{children}</>;
}
