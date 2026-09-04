'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import AviBuilderMark from '@/components/branding/AviBuilderMark';
import { getProjectSlugFromPath, getSettingsNavItems } from '@/lib/settings-nav-items';

export default function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const slug = getProjectSlugFromPath(pathname);
  const items = getSettingsNavItems(slug);
  const canvasHref = `/projects/${slug}`;
  const cmsHref = `/projects/${slug}/collections`;
  const formsHref = `/projects/${slug}/forms`;
  const previewHost = `https://${slug}.avibuilder.com`;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="grid h-14 grid-cols-3 items-center border-b px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            variant="secondary" size="sm"
            className="size-8!" asChild
          >
            <Link href={canvasHref} aria-label="Avi Builder">
              <AviBuilderMark className="size-4 text-secondary-foreground" />
            </Link>
          </Button>
          <div className="hidden items-center gap-1 sm:flex">
            <Button
              variant="ghost" size="sm"
              asChild
            >
              <Link href={canvasHref}>Design</Link>
            </Button>
            <Button
              variant="ghost" size="sm"
              asChild
            >
              <Link href={cmsHref}>CMS</Link>
            </Button>
            <Button
              variant="ghost" size="sm"
              asChild
            >
              <Link href={formsHref}>Forms</Link>
            </Button>
          </div>
        </div>
        <a
          href={previewHost}
          target="_blank"
          rel="noreferrer"
          className="truncate text-center text-xs text-muted-foreground"
        >
          {previewHost.replace('https://', '')}
        </a>
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost" size="sm"
            className="hidden sm:inline-flex" asChild
          >
            <Link href={`${canvasHref}/settings/users`}>Invite</Link>
          </Button>
          <span className="hidden text-xs text-muted-foreground md:inline">Ready</span>
          <Button
            variant="ghost" size="sm"
            asChild
          >
            <Link href={`${canvasHref}?preview=true`}>Preview</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={canvasHref}>Publish</Link>
          </Button>
        </div>
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
