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
}

/**
 * Builder follows the saved theme (default system).
 * Published sites follow the device light/dark setting so color tokens swap.
 */
export default function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const isPreviewRoute = pathname?.includes('/preview');
    const onBuilder = isBuilderHost();
    const isBuilderRoute = onBuilder && !isPreviewRoute && pathname?.startsWith('/projects/');

    if (isBuilderRoute) {
      applyClass(shouldApplyDark());
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => applyClass(shouldApplyDark());
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    applyClass(mq.matches);
    const onChange = () => applyClass(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pathname]);

  return <>{children}</>;
}
