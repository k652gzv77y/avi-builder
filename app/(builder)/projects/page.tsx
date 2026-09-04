'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    fetch('/ycode/api/projects')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setProjects(data.projects || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load projects'));
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-white/10 px-8 py-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40">Avi Builder</p>
          <h1 className="text-xl font-medium">Projects</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-8 py-10">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {!projects && !error && <p className="text-white/50 text-sm">Loading…</p>}
        {projects && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {projects.map((project) => {
              const primary = project.domains.find((d) => d.is_primary) || project.domains[0];
              return (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="block rounded-xl border border-white/10 bg-white/5 p-5 hover:border-white/25 hover:bg-white/8 transition"
                  >
                    <h2 className="text-lg font-medium">{project.name}</h2>
                    <p className="mt-1 text-sm text-white/50">/{project.slug}</p>
                    <p className="mt-3 text-xs text-white/40">
                      {primary ? primary.hostname : 'No published domain'}
                      {project.supabase_project_name ? ` · ${project.supabase_project_name}` : ''}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
