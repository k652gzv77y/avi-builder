'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getProjectSlugFromPath, getSettingsNavItems } from '@/lib/settings-nav-items';

export default function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const slug = getProjectSlugFromPath(pathname);
  const items = getSettingsNavItems(slug);
  const canvasHref = `/projects/${slug}`;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur">
        <Link href={canvasHref} className="text-sm font-medium">
          Avi Builder
        </Link>
        <Link href={canvasHref} className="text-xs text-muted-foreground">
          Back to canvas
        </Link>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-col md:flex-row">
        <nav className="flex gap-1 overflow-x-auto border-b px-3 py-2 md:w-52 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:py-6">
          {items.map((item) => {
            const active = pathname === item.path || pathname?.startsWith(`${item.path}/`);
            return (
              <Link
                key={item.id}
                href={item.path}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${
                  active ? 'bg-accent font-medium' : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
