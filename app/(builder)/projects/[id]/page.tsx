'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

type Domain = { hostname: string; status: string; is_primary: boolean };
type Project = {
  id: string;
  slug: string;
  name: string;
  domains: Domain[];
};

type FillKind = 'Color' | 'Image' | 'Gradient' | 'Variable';
type Fill = { id: string; kind: FillKind; label: string };

const BREAKPOINTS = [
  { id: 'desktop', label: 'Desktop', width: 1200 },
  { id: 'tablet', label: 'Tablet', width: 768 },
  { id: 'phone', label: 'Phone', width: 390 },
];

export default function ProjectCanvasPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [project, setProject] = useState<Project | null>(null);
  const [leftTab, setLeftTab] = useState<'pages' | 'layers' | 'assets'>('pages');
  const [breakpoints, setBreakpoints] = useState(BREAKPOINTS);
  const [active, setActive] = useState('desktop');
  const [customWidth, setCustomWidth] = useState('1440');
  const [fills, setFills] = useState<Fill[]>([
    { id: 'fill-1', kind: 'Image', label: 'Image' },
  ]);
  const [bindOpen, setBindOpen] = useState(false);

  useEffect(() => {
    fetch('/ycode/api/projects')
      .then((r) => r.json())
      .then((data) => {
        const match = (data.projects || []).find((p: Project) => p.id === id);
        setProject(match || null);
      })
      .catch(() => setProject(null));
  }, [id]);

  const primary = project?.domains.find((d) => d.is_primary) || project?.domains[0];

  function addBreakpoint() {
    const width = Number(customWidth);
    if (!Number.isFinite(width) || width < 320 || width > 4000) return;
    const next = { id: `bp-${width}`, label: `${width}`, width };
    setBreakpoints((list) => (list.some((b) => b.width === width) ? list : [...list, next].sort((a, b) => b.width - a.width)));
    setActive(next.id);
  }

  function addFill(kind: FillKind) {
    setFills((list) => [...list, { id: `fill-${Date.now()}`, kind, label: kind === 'Variable' ? 'Accents / Teal' : kind }]);
    setBindOpen(false);
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-50 text-neutral-900 dark:bg-[#111113] dark:text-[#eee]">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-black/8 px-3 dark:border-white/8">
        <div className="flex items-center gap-3">
          <Link href="/projects" className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-900 text-[11px] font-semibold text-white dark:bg-white dark:text-black">
            A
          </Link>
          <nav className="flex items-center gap-1 text-[12px]">
            {['Design', 'CMS', 'Forms'].map((tab) => (
              <Link
                key={tab}
                href={tab === 'Design' ? `/projects/${id}` : tab === 'CMS' ? '/ycode/collections' : '/ycode/forms'}
                className={`rounded-md px-2 py-1 ${
                  tab === 'Design'
                    ? 'bg-black/6 text-neutral-900 dark:bg-white/8 dark:text-white'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-white/50 dark:hover:text-white/80'
                }`}
              >
                {tab}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden text-[12px] text-neutral-500 dark:text-white/45 sm:block">
          {project?.name || 'Project'}
          {primary ? ` · ${primary.hostname}` : ''}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/ycode" className="rounded-md px-2 py-1 text-[12px] text-neutral-500 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/5">
            Legacy editor
          </Link>
          <button type="button" className="rounded-md bg-[#0099ff] px-2.5 py-1 text-[12px] font-medium text-white">
            Publish
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[232px] shrink-0 flex-col border-r border-black/8 bg-white dark:border-white/8 dark:bg-[#161618]">
          <div className="flex border-b border-black/8 p-1 dark:border-white/8">
            {([
              ['pages', 'Pages'],
              ['layers', 'Layers'],
              ['assets', 'Assets'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setLeftTab(key)}
                className={`flex-1 rounded-md py-1.5 text-[11px] ${
                  leftTab === key
                    ? 'bg-black/8 text-neutral-900 dark:bg-white/10 dark:text-white'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-white/45 dark:hover:text-white/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2 text-[12px]">
            {leftTab === 'pages' && (
              <ul className="space-y-0.5">
                {['Home', 'About', 'Schedule', 'Contact'].map((name, i) => (
                  <li key={name}>
                    <button
                      type="button"
                      className={`flex w-full items-center rounded-md px-2 py-1.5 text-left ${
                        i === 0
                          ? 'bg-black/6 text-neutral-900 dark:bg-white/8 dark:text-white'
                          : 'text-neutral-500 hover:bg-black/4 dark:text-white/55 dark:hover:bg-white/4'
                      }`}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {leftTab === 'layers' && (
              <ul className="space-y-0.5 text-neutral-500 dark:text-white/55">
                {['Desktop', 'Hero', 'Heading', 'Stack', 'Button'].map((name) => (
                  <li key={name} className="rounded-md px-2 py-1.5 hover:bg-black/4 dark:hover:bg-white/4">
                    {name}
                  </li>
                ))}
              </ul>
            )}
            {leftTab === 'assets' && (
              <p className="px-2 py-1.5 text-neutral-400 dark:text-white/40">Drop images and components here.</p>
            )}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-neutral-100 dark:bg-[#0c0c0d]">
          <div className="flex h-10 shrink-0 items-center gap-2 overflow-x-auto border-b border-black/8 px-3 dark:border-white/8">
            {breakpoints.map((bp) => (
              <button
                key={bp.id}
                type="button"
                onClick={() => setActive(bp.id)}
                className={`shrink-0 rounded-md px-2 py-1 text-[11px] ${
                  active === bp.id
                    ? 'bg-black/8 text-neutral-900 dark:bg-white/10 dark:text-white'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-white/45 dark:hover:text-white/70'
                }`}
              >
                {bp.label} · {bp.width}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <input
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                className="h-7 w-16 rounded-md border border-black/10 bg-transparent px-2 text-[11px] outline-none dark:border-white/10"
              />
              <button type="button" onClick={addBreakpoint} className="rounded-md px-2 py-1 text-[11px] text-neutral-500 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/5">
                Add size
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-start gap-6 overflow-auto p-8">
            {breakpoints.map((bp) => (
              <section key={bp.id} className="shrink-0" style={{ width: Math.min(bp.width, 520) }}>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-neutral-400 dark:text-white/30">
                  {bp.label} · {bp.width}
                </p>
                <div
                  className={`overflow-hidden rounded-[10px] border bg-white dark:bg-[#111] ${
                    active === bp.id ? 'border-[#0099ff]/70' : 'border-black/10 dark:border-white/10'
                  }`}
                  style={{ width: Math.min(bp.width, 520), height: 640 }}
                >
                  <div className="flex h-7 items-center gap-1 border-b border-black/8 px-2 dark:border-white/8">
                    <span className="h-1.5 w-1.5 rounded-full bg-black/20 dark:bg-white/20" />
                    <span className="h-1.5 w-1.5 rounded-full bg-black/20 dark:bg-white/20" />
                    <span className="h-1.5 w-1.5 rounded-full bg-black/20 dark:bg-white/20" />
                  </div>
                  <div className="p-5">
                    <div className="mb-3 h-2 w-24 rounded bg-[#0099ff]/70" />
                    <div className="mb-2 h-2 w-3/4 rounded bg-black/10 dark:bg-white/12" />
                    <div className="h-2 w-1/2 rounded bg-black/6 dark:bg-white/8" />
                  </div>
                </div>
              </section>
            ))}
          </div>
        </main>

        <aside className="w-[280px] shrink-0 overflow-auto border-l border-black/8 bg-white p-3 dark:border-white/8 dark:bg-[#161618]">
          <p className="mb-3 text-[11px] uppercase tracking-wider text-neutral-400 dark:text-white/35">Style</p>
          {[
            ['Position', 'Relative'],
            ['Width', 'Fill'],
            ['Height', 'Fit'],
          ].map(([label, value]) => (
            <div key={label} className="mb-2 flex items-center justify-between text-[12px]">
              <span className="text-neutral-500 dark:text-white/40">{label}</span>
              <span className="rounded-md bg-black/5 px-2 py-1 text-neutral-700 dark:bg-white/5 dark:text-white/70">{value}</span>
            </div>
          ))}

          <div className="mt-4 rounded-2xl border border-black/8 bg-neutral-950 px-3 py-2.5 text-white dark:border-white/10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBindOpen((open) => !open)}
                className="flex items-center gap-1.5 text-[13px] font-medium text-[#5ab4ff]"
              >
                <span className="grid h-5 w-5 place-items-center rounded-full border border-[#5ab4ff]/40 text-[15px] leading-none">+</span>
                Fill
              </button>
              <div className="ml-auto flex min-w-0 flex-1 flex-wrap justify-end gap-1.5">
                {fills.map((fill) => (
                  <span key={fill.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#7ad0ff] px-2.5 py-1 text-[12px] font-medium text-[#083044]">
                    <span className="grid h-4 w-4 place-items-center rounded-[5px] bg-white/80 text-[10px]">▲</span>
                    {fill.label}
                    <button type="button" className="text-[#083044]/60" onClick={() => setFills((list) => list.filter((item) => item.id !== fill.id))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            {bindOpen && (
              <div className="mt-2 grid grid-cols-2 gap-1 border-t border-white/10 pt-2 text-[12px]">
                {(['Color', 'Image', 'Gradient', 'Variable'] as FillKind[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => addFill(kind)}
                    className="rounded-md px-2 py-1.5 text-left text-white/70 hover:bg-white/8"
                  >
                    {kind === 'Variable' ? 'Bind variable' : kind}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-neutral-400 dark:text-white/35">
            Plus binds a fill, image, or Figma-style variable. Spreadsheet tokens live in CMS.
          </p>
        </aside>
      </div>
    </div>
  );
}
