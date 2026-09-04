'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import ColorStylePicker, { type ColorStyle } from '@/components/builder/ColorStylePicker';

type Domain = { hostname: string; status: string; is_primary: boolean };
type Project = {
  id: string;
  slug: string;
  name: string;
  domains: Domain[];
};
type Breakpoint = { id: string; label: string; width: number };

const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { id: 'desktop', label: 'Desktop', width: 1200 },
  { id: 'tablet', label: 'Tablet', width: 810 },
  { id: 'phone', label: 'Phone', width: 390 },
];

export default function ProjectCanvasPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [project, setProject] = useState<Project | null>(null);
  const [leftTab, setLeftTab] = useState<'pages' | 'layers' | 'assets'>('pages');
  const [breakpoints, setBreakpoints] = useState(DEFAULT_BREAKPOINTS);
  const [active, setActive] = useState('desktop');
  const [customWidth, setCustomWidth] = useState('1440');
  const [boundStyle, setBoundStyle] = useState<ColorStyle | null>(null);
  const [pickerOpen, setPickerOpen] = useState(true);

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

  function resizeBreakpoint(bpId: string, width: number) {
    if (!Number.isFinite(width) || width < 320 || width > 4000) return;
    setBreakpoints((list) => list.map((bp) => (bp.id === bpId ? { ...bp, width } : bp)));
  }

  function removeBreakpoint(bpId: string) {
    setBreakpoints((list) => (list.length <= 1 ? list : list.filter((bp) => bp.id !== bpId)));
    if (active === bpId) setActive(breakpoints.find((bp) => bp.id !== bpId)?.id || '');
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-50 text-neutral-900 dark:bg-[#111113] dark:text-[#eee]">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-black/8 px-3 dark:border-white/8">
        <div className="flex items-center gap-3">
          <Link href="/projects" className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-900 text-[11px] font-semibold text-white dark:bg-white dark:text-black">A</Link>
          <nav className="flex items-center gap-1 text-[12px]">
            <Link href={`/projects/${id}`} className="rounded-md bg-black/6 px-2 py-1 dark:bg-white/8">Design</Link>
            <Link href="/ycode/collections" className="rounded-md px-2 py-1 text-neutral-500 dark:text-white/50">CMS</Link>
            <Link href={`/projects/${id}/domains`} className="rounded-md px-2 py-1 text-neutral-500 dark:text-white/50">Domains</Link>
          </nav>
        </div>
        <div className="hidden text-[12px] text-neutral-500 sm:block dark:text-white/45">
          {project?.name || 'Project'} · {primary?.hostname || `${project?.slug || 'project'}.avibuilder.com`}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button type="button" className="rounded-md bg-[#0099ff] px-2.5 py-1 text-[12px] font-medium text-white">Publish</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[232px] shrink-0 flex-col border-r border-black/8 bg-white dark:border-white/8 dark:bg-[#161618]">
          <div className="flex border-b border-black/8 p-1 dark:border-white/8">
            {(['pages', 'layers', 'assets'] as const).map((key) => (
              <button key={key} type="button" onClick={() => setLeftTab(key)} className={`flex-1 rounded-md py-1.5 text-[11px] capitalize ${leftTab === key ? 'bg-black/8 dark:bg-white/10' : 'text-neutral-500'}`}>
                {key}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2 text-[12px]">
            {leftTab === 'pages' && ['Home', 'About', 'Schedule', 'Contact'].map((name, i) => (
              <button key={name} type="button" className={`mb-0.5 w-full rounded-md px-2 py-1.5 text-left ${i === 0 ? 'bg-black/6 dark:bg-white/8' : 'text-neutral-500'}`}>{name}</button>
            ))}
            {leftTab === 'layers' && ['Desktop', 'Hero', 'Heading', 'Stack'].map((name) => (
              <div key={name} className="px-2 py-1.5 text-neutral-500">{name}</div>
            ))}
            {leftTab === 'assets' && <p className="px-2 text-neutral-400">Assets</p>}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-neutral-100 dark:bg-[#0c0c0d]">
          <div className="flex h-10 shrink-0 items-center gap-2 overflow-x-auto border-b border-black/8 px-3 dark:border-white/8">
            {breakpoints.map((bp) => (
              <div key={bp.id} className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] ${active === bp.id ? 'bg-black/8 dark:bg-white/10' : 'text-neutral-500'}`}>
                <button type="button" onClick={() => setActive(bp.id)}>{bp.label}</button>
                <input
                  defaultValue={bp.width}
                  onBlur={(e) => resizeBreakpoint(bp.id, Number(e.target.value))}
                  className="h-5 w-12 bg-transparent text-center outline-none"
                />
                <button type="button" onClick={() => removeBreakpoint(bp.id)} className="text-neutral-400">×</button>
              </div>
            ))}
            <input value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} className="ml-auto h-7 w-14 rounded-md border border-black/10 bg-transparent px-1 text-[11px] dark:border-white/10" />
            <button type="button" onClick={addBreakpoint} className="text-[11px] text-neutral-500">Add size</button>
          </div>
          <div className="flex min-h-0 flex-1 items-start gap-6 overflow-auto p-8">
            {breakpoints.map((bp) => (
              <section key={bp.id} className="shrink-0">
                <p className="mb-2 text-[11px] uppercase tracking-wider text-neutral-400">{bp.label} · {bp.width}</p>
                <div className={`rounded-[10px] border bg-white dark:bg-[#111] ${active === bp.id ? 'border-[#0099ff]/70' : 'border-black/10 dark:border-white/10'}`} style={{ width: Math.min(bp.width, 520), height: 640 }} />
              </section>
            ))}
          </div>
        </main>

        <aside className="w-[300px] shrink-0 overflow-auto border-l border-black/8 bg-white p-3 dark:border-white/8 dark:bg-[#161618]">
          <div className="mb-3 flex gap-1 text-[12px]">
            <span className="rounded-md bg-black/6 px-2 py-1 dark:bg-white/8">Style</span>
            <span className="px-2 py-1 text-neutral-400">Agent</span>
          </div>
          {boundStyle && (
            <button type="button" onClick={() => setPickerOpen(true)} className="mb-3 flex w-full items-center gap-2 rounded-lg bg-black/5 px-2 py-1.5 text-left text-[12px] dark:bg-white/6">
              <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: boundStyle.light }} />
              {boundStyle.name}
            </button>
          )}
          {pickerOpen && (
            <ColorStylePicker
              value={boundStyle}
              onChange={(style) => {
                setBoundStyle(style);
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          )}
          {!pickerOpen && (
            <button type="button" onClick={() => setPickerOpen(true)} className="mt-2 text-[12px] text-[#0099ff]">+ Fill / bind style</button>
          )}
        </aside>
      </div>
    </div>
  );
}
