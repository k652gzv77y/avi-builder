'use client';

import { useEffect, useState } from 'react';
import {
  BUILDER_THEME_EVENT,
  type BuilderTheme,
  readBuilderTheme,
  writeBuilderTheme,
} from '@/components/DarkModeProvider';

const OPTIONS: { value: BuilderTheme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<BuilderTheme>('system');

  useEffect(() => {
    const sync = () => setTheme(readBuilderTheme());
    sync();
    window.addEventListener(BUILDER_THEME_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(BUILDER_THEME_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return (
    <div
      className={`inline-flex items-center rounded-md border border-border bg-secondary/40 p-0.5 text-xs ${className}`}
      role="group"
      aria-label="Builder appearance"
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              writeBuilderTheme(option.value);
              setTheme(option.value);
            }}
            className={`rounded px-2 py-1 transition-colors ${
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
