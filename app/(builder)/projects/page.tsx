'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  ChevronDown,
  Clock3,
  FileText,
  FolderKanban,
  PanelTop,
  Search,
} from 'lucide-react';
import AviBuilderMark from '@/components/branding/AviBuilderMark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/useAuthStore';

const PROJECT_SLUG = 'kolbo-school';
const PROJECT_URL = `/projects/${PROJECT_SLUG}`;

function ProjectPreview() {
  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-muted p-3">
      <div className="absolute inset-x-0 top-0 h-6 border-b border-border bg-secondary" />
      <div className="absolute left-3 top-2.5 flex gap-1">
        <span className="size-1.5 rounded-full bg-foreground/35" />
        <span className="size-1.5 rounded-full bg-foreground/20" />
        <span className="size-1.5 rounded-full bg-foreground/20" />
      </div>
      <div className="absolute inset-x-3 bottom-3 top-9 grid grid-cols-[26%_1fr] gap-2">
        <div className="border border-border bg-background/40 p-2">
          <div className="h-1.5 w-9 rounded-sm bg-foreground/35" />
          <div className="mt-3 space-y-1.5">
            <div className="h-1 w-12 rounded-sm bg-foreground/15" />
            <div className="h-1 w-9 rounded-sm bg-foreground/10" />
            <div className="h-1 w-11 rounded-sm bg-foreground/10" />
          </div>
        </div>
        <div className="relative overflow-hidden border border-border bg-secondary">
          <div className="absolute inset-x-[18%] top-[16%] h-2 w-[33%] rounded-sm bg-blue-400/85" />
          <div className="absolute inset-x-[18%] top-[29%] h-1.5 w-[51%] rounded-sm bg-foreground/65" />
          <div className="absolute inset-x-[18%] top-[39%] h-1 w-[39%] rounded-sm bg-foreground/25" />
          <div className="absolute inset-x-[18%] top-[56%] grid grid-cols-3 gap-1.5">
            <div className="aspect-square bg-muted" />
            <div className="aspect-square bg-muted" />
            <div className="aspect-square bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const initialize = useAuthStore((state) => state.initialize);
  const initialized = useAuthStore((state) => state.initialized);
  const user = useAuthStore((state) => state.user);
  const [projectName, setProjectName] = useState('Kolbo School');
  const [query, setQuery] = useState('');

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (initialized && !user) {
      router.replace(PROJECT_URL);
    }
  }, [initialized, router, user]);

  useEffect(() => {
    if (!user) return;
    void fetch(`${PROJECT_URL}/api/settings/site_name`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json() as { data?: unknown };
        if (typeof payload.data === 'string' && payload.data.trim()) {
          setProjectName(payload.data.trim());
        }
      })
      .catch(() => undefined);
  }, [user]);

  const isVisible = useMemo(
    () => projectName.toLowerCase().includes(query.trim().toLowerCase()),
    [projectName, query],
  );
  const initial = projectName.trim().charAt(0).toUpperCase() || 'K';

  if (!initialized || !user) {
    return <div className="min-h-dvh bg-background" />;
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto grid min-h-dvh max-w-[1600px] grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="relative border-b border-border px-4 py-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between lg:block">
            <Link href="/projects" className="inline-flex items-center gap-2.5 text-sm font-medium">
              <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
                <AviBuilderMark className="h-5 w-5 min-h-5 min-w-5" />
              </span>
              Avi Builder
            </Link>
          </div>

          <nav className="mt-8 hidden space-y-1 lg:block" aria-label="Workspace">
            <Link href="/projects" className="flex h-8 items-center gap-2 rounded-md bg-secondary px-2.5 text-xs font-medium text-foreground">
              <FolderKanban className="size-3.5" />
              Projects
            </Link>
            <a href={PROJECT_URL} className="flex h-8 items-center gap-2 rounded-md px-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <PanelTop className="size-3.5" />
              Editor
            </a>
          </nav>

          <div className="mt-8 hidden border-t border-border pt-4 lg:block">
            <p className="px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Workspace</p>
            <div className="mt-2 flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-foreground/80">
              <span className="flex size-5 items-center justify-center rounded bg-blue-400 text-[10px] font-semibold text-black">{initial}</span>
              <span className="min-w-0 flex-1 truncate">Personal</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </div>
          </div>

          <div className="mt-8 hidden lg:block lg:absolute lg:bottom-4">
            <Link href={`${PROJECT_URL}/profile`} className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-[9px] font-semibold text-foreground">{initial}</span>
              <span className="max-w-32 truncate">{user.email ?? 'Account'}</span>
            </Link>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-7 sm:py-7 lg:px-10 lg:py-9">
          <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Personal workspace</p>
              <h1 className="mt-1 text-xl font-medium tracking-normal text-foreground">Projects</h1>
            </div>
            <div className="w-full sm:w-56">
              <div className="relative min-w-0 flex-1 sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search projects"
                  className="h-8 border-border bg-secondary/40 pl-8 text-xs placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </header>

          <div className="flex items-center justify-between pt-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">All projects</span>
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">1</span>
            </div>
            <span className="text-[11px] text-muted-foreground">1 project</span>
          </div>

          {isVisible ? (
            <article className="group mt-4 max-w-[520px] overflow-hidden border border-border bg-card text-card-foreground transition-colors hover:border-foreground/20">
              <Link href={PROJECT_URL} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ProjectPreview />
              </Link>
              <div className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <Link href={PROJECT_URL} className="block truncate text-sm font-medium text-foreground hover:underline">{projectName}</Link>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock3 className="size-3" /> Active now</span>
                    <span className="inline-flex items-center gap-1"><FileText className="size-3" /> Website</span>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild variant="ghost"
                      size="icon-sm" className="text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label={`Open ${projectName}`}
                    >
                      <Link href={PROJECT_URL}><ArrowUpRight /></Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Open project</TooltipContent>
                </Tooltip>
              </div>
            </article>
          ) : (
            <div className="mt-4 max-w-[520px] border border-dashed border-border px-5 py-12 text-center text-xs text-muted-foreground">
              No projects match &ldquo;{query}&rdquo;.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
