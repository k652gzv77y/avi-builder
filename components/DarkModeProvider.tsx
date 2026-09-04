'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export type BuilderTheme = 'system' | 'light' | 'dark';

export const BUILDER_THEME_KEY = 'theme';
export const BUILDER_THEME_EVENT = 'avi-builder-theme';

export function readBuilderTheme(): BuilderTheme {
  if (typeof window === 'undefined') return 'system';
  const saved = localStorage.getItem(BUILDER_THEME_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  return 'system';
}

export function writeBuilderTheme(theme: BuilderTheme) {
  localStorage.setItem(BUILDER_THEME_KEY, theme);
  window.dispatchEvent(new CustomEvent(BUILDER_THEME_EVENT, { detail: theme }));
  applyBuilderTheme(theme);
}

export function resolveDark(theme: BuilderTheme = readBuilderTheme()): boolean {
  if (theme === 'light') return false;
  if (theme === 'dark') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyBuilderTheme(theme: BuilderTheme = readBuilderTheme()) {
  const root = document.documentElement;
  const dark = resolveDark(theme);
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  root.dataset.theme = theme;
}

export default function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const isPreview = pathname?.startsWith('/editor/preview') || pathname?.startsWith('/ycode/preview');
    const isEditorPath = pathname?.startsWith('/editor') || pathname?.startsWith('/ycode');

    const useProductTheme =
      !isPreview &&
      (pathname === '/' || isEditorPath || pathname?.startsWith('/login'));

    if (!useProductTheme) {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      return;
    }

    applyBuilderTheme();

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystem = () => {
      if (readBuilderTheme() === 'system') applyBuilderTheme('system');
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === BUILDER_THEME_KEY) applyBuilderTheme();
    };
    const onCustom = () => applyBuilderTheme();

    media.addEventListener('change', onSystem);
    window.addEventListener('storage', onStorage);
    window.addEventListener(BUILDER_THEME_EVENT, onCustom);

    return () => {
      media.removeEventListener('change', onSystem);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(BUILDER_THEME_EVENT, onCustom);
    };
  }, [pathname]);

  return <>{children}</>;
}
