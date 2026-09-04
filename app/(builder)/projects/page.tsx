'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Domain = { hostname: string; status: string; is_primary: boolean };
type Project = {
  id: string;
  slug: string;
  name: string;
  database_mode: string;
  supabase_project_name: string | null;
  domains: Domain[];
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/ycode/api/projects')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok || data.error) throw new Error(data.error || `Could not load projects (${r.status})`);
        setProjects(data.projects || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load projects'));
  }, []);

  const filtered = useMemo(() => {
    const list = projects || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const host = (p.domains.find((d) => d.is_primary) || p.domains[0])?.hostname || '';
      return `${p.name} ${p.slug} ${host}`.toLowerCase().includes(q);
    });
  }, [projects, query]);

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-[#f5f5f5]">
      <header className="flex h-12 items-center justify-between border-b border-white/8 px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-[11px] font-semibold text-black">
            A
          </div>
          <span className="text-[13px] font-medium tracking-tight">Avi Builder</span>
          <span className="text-white/25">/</span>
          <button type="button" className="rounded-md px-1.5 py-0.5 text-[13px] text-white/70 hover:bg-white/5">
            Personal workspace
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md px-2.5 py-1 text-[12px] text-white/60 hover:bg-white/5"
          >
            Invite
          </button>
          <button
            type="button"
            className="rounded-md bg-white px-2.5 py-1 text-[12px] font-medium text-black"
          >
            New project
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-5 pb-16 pt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Personal workspace</p>
            <h1 className="mt-1 text-[28px] font-medium tracking-tight">Projects</h1>
          </div>
          <label className="relative block w-full max-w-xs">
            <span className="sr-only">Search projects</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects"
              className="h-9 w-full rounded-lg border border-white/10 bg-white/4 px-3 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
            />
          </label>
        </div>

        <div className="mb-3 flex items-center justify-between text-[12px] text-white/40">
          <span>All projects {projects ? <span className="ml-1 rounded-full bg-white/8 px-1.5 py-0.5 text-[11px]">{filtered.length}</span> : null}</span>
          <span>{projects ? `${filtered.length} project${filtered.length === 1 ? '' : 's'}` : ''}</span>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
            {error}
          </p>
        )}

        {!projects && !error && <p className="text-[13px] text-white/40">Loading…</p>}

        {projects && filtered.length === 0 && (
          <p className="text-[13px] text-white/40">No projects match that search.</p>
        )}

        {projects && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project) => {
              const primary = project.domains.find((d) => d.is_primary) || project.domains[0];
              return (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="group block overflow-hidden rounded-xl border border-white/10 bg-[#141416] transition hover:border-white/20"
                  >
                    <div className="relative aspect-[16/10] border-b border-white/8 bg-[#0f0f10]">
                      <div className="absolute inset-3 rounded-md border border-white/8 bg-[#1a1a1c]">
                        <div className="flex h-6 items-center gap-1 border-b border-white/8 px-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                        </div>
                        <div className="flex h-[calc(100%-1.5rem)]">
                          <div className="w-1/4 border-r border-white/8 p-2">
                            <div className="mb-1.5 h-1 w-8 rounded bg-white/15" />
                            <div className="mb-1 h-1 w-10 rounded bg-white/10" />
                            <div className="h-1 w-7 rounded bg-white/10" />
                          </div>
                          <div className="flex-1 p-3">
                            <div className="mb-2 h-1.5 w-1/2 rounded bg-[#0099ff]/80" />
                            <div className="mb-1.5 h-1 w-2/3 rounded bg-white/15" />
                            <div className="h-1 w-1/3 rounded bg-white/10" />
                            <div className="mt-4 grid grid-cols-3 gap-2">
                              <div className="aspect-square rounded bg-white/6" />
                              <div className="aspect-square rounded bg-white/6" />
                              <div className="aspect-square rounded bg-white/6" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-3 px-3.5 py-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-[13px] font-medium">{project.name}</h2>
                        <p className="mt-0.5 truncate text-[11px] text-white/40">
                          {primary ? primary.hostname : 'Not published'}
                          {project.supabase_project_name ? ` · ${project.supabase_project_name}` : ''}
                        </p>
                      </div>
                      <span className="mt-0.5 text-white/25 transition group-hover:text-white/60">↗</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
