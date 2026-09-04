'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Domain = { hostname: string; status: string; is_primary: boolean };
type Project = {
  id: string;
  slug: string;
  name: string;
  domains: Domain[];
};

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

  return (
    <div className="flex h-screen flex-col bg-[#111113] text-[#eee] ">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/8 px-3">
        <div className="flex items-center gap-3">
          <Link href="/projects" className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-[11px] font-semibold text-black">
            A
          </Link>
          <nav className="flex items-center gap-1 text-[12px]">
            {['Design', 'CMS', 'Forms'].map((tab) => (
              <Link
                key={tab}
                href={tab === 'Design' ? `/projects/${id}` : tab === 'CMS' ? '/ycode/collections' : '/ycode/forms'}
                className={`rounded-md px-2 py-1 ${
                  tab === 'Design' ? 'bg-white/8 text-white' : 'text-white/50 hover:text-white/80'
                }`}
              >
                {tab}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden text-[12px] text-white/45 sm:block">
          {project?.name || 'Project'}
          {primary ? ` · ${primary.hostname}` : ''}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/ycode" className="rounded-md px-2 py-1 text-[12px] text-white/50 hover:bg-white/5">
            Legacy editor
          </Link>
          <button type="button" className="rounded-md bg-[#0099ff] px-2.5 py-1 text-[12px] font-medium text-white">
            Publish
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[232px] shrink-0 flex-col border-r border-white/8 bg-[#161618]">
          <div className="flex border-b border-white/8 p-1">
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
                  leftTab === key ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white/70'
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
                        i === 0 ? 'bg-white/8 text-white' : 'text-white/55 hover:bg-white/4'
                      }`}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {leftTab === 'layers' && (
              <ul className="space-y-0.5 text-white/55">
                {['Desktop', 'Hero', 'Heading', 'Stack', 'Button'].map((name) => (
                  <li key={name} className="rounded-md px-2 py-1.5 hover:bg-white/4">
                    {name}
                  </li>
                ))}
              </ul>
            )}
            {leftTab === 'assets' && (
              <p className="px-2 py-1.5 text-white/40">Drop images and components here.</p>
            )}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-[#0c0c0d]">
          <div className="flex h-10 shrink-0 items-center gap-2 overflow-x-auto border-b border-white/8 px-3">
            {breakpoints.map((bp) => (
              <button
                key={bp.id}
                type="button"
                onClick={() => setActive(bp.id)}
                className={`shrink-0 rounded-md px-2 py-1 text-[11px] ${
                  active === bp.id ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white/70'
                }`}
              >
                {bp.label} · {bp.width}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <input
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                className="h-7 w-16 rounded-md border border-white/10 bg-transparent px-2 text-[11px] outline-none"
              />
              <button
                type="button"
                onClick={addBreakpoint}
                className="rounded-md px-2 py-1 text-[11px] text-white/60 hover:bg-white/5"
              >
                Add size
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-start gap-6 overflow-auto p-8">
            {breakpoints.map((bp) => (
              <section key={bp.id} className="shrink-0" style={{ width: Math.min(bp.width, 520) }}>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-white/30">
                  {bp.label} · {bp.width}
                </p>
                <div
                  className={`overflow-hidden rounded-[10px] border bg-[#111] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] ${
                    active === bp.id ? 'border-[#0099ff]/70' : 'border-white/10'
                  }`}
                  style={{ width: Math.min(bp.width, 520), height: 640 }}
                >
                  <div className="flex h-7 items-center gap-1 border-b border-white/8 px-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                  </div>
                  <div className="p-5">
                    <div className="mb-3 h-2 w-24 rounded bg-[#0099ff]/70" />
                    <div className="mb-2 h-2 w-3/4 rounded bg-white/12" />
                    <div className="h-2 w-1/2 rounded bg-white/8" />
                    <div className="mt-8 grid grid-cols-2 gap-3">
                      <div className="h-24 rounded-md bg-white/5" />
                      <div className="h-24 rounded-md bg-white/5" />
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </main>

        <aside className="w-[260px] shrink-0 overflow-auto border-l border-white/8 bg-[#161618] p-3">
          <p className="mb-3 text-[11px] uppercase tracking-wider text-white/35">Properties</p>
          {[
            ['Position', 'Relative'],
            ['Width', 'Fill'],
            ['Height', 'Fit'],
            ['Fill', '—'],
          ].map(([label, value]) => (
            <div key={label} className="mb-2 flex items-center justify-between text-[12px]">
              <span className="text-white/40">{label}</span>
              <span className="rounded-md bg-white/5 px-2 py-1 text-white/70">{value}</span>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
