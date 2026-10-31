'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import DomainManager from '@/components/workspace/domain-manager';
import { rememberProjectSlug } from '@/lib/project-url';
import {
  WORKSPACE_API_PATH,
  readActiveBranch,
  resolveActiveBranchSlug,
  writeActiveBranch,
  type ProjectView,
  type WorkspaceOverview,
} from '@/lib/workspace';

interface ProjectSpaceProps {
  slug: string;
  initialBranch?: string | null;
}

export default function ProjectSpace({ slug, initialBranch = null }: ProjectSpaceProps) {
  const [project, setProject] = useState<ProjectView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchName, setBranchName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [active, setActive] = useState(initialBranch ?? 'staging');

  useEffect(() => {
    if (slug) rememberProjectSlug(slug);
  }, [slug]);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError('This project link is missing a slug.');
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const response = await fetch(WORKSPACE_API_PATH, { cache: 'no-store' });
        const payload = await response.json().catch(() => ({})) as { data?: WorkspaceOverview; error?: string };
        if (cancelled) return;
        if (response.status === 401) {
          setError('Sign in to open this project.');
          return;
        }
        if (!response.ok) {
          setError(payload.error || 'Could not load this project');
          return;
        }
        const match = payload.data?.projects.find((entry) => entry.slug === slug) ?? null;
        setProject(match);
        if (!match) setError('Project not found on your accounts.');
        else {
          setActive(resolveActiveBranchSlug(initialBranch ?? readActiveBranch(slug), match.branches));
        }
      } catch {
        if (!cancelled) setError('Could not load this project');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialBranch, slug]);

  const activeBranch = useMemo(
    () => project?.branches.find((branch) => branch.slug === active) ?? null,
    [active, project],
  );

  async function handleCreateBranch() {
    if (!project || !branchName.trim()) return;
    setMessage(null);
    const response = await fetch(`${WORKSPACE_API_PATH}/projects/${project.slug}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: branchName.trim() }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; data?: WorkspaceOverview };
    if (!response.ok) {
      setMessage(payload.error || 'Could not create the branch');
      return;
    }
    const next = payload.data?.projects.find((entry) => entry.slug === project.slug) ?? null;
    setProject(next);
    const created = next?.branches.find((branch) => branch.name === branchName.trim());
    if (created) {
      writeActiveBranch(project.slug, created.slug);
      setActive(created.slug);
    }
    setBranchName('');
  }

  async function handlePromote() {
    if (!project || !activeBranch) return;
    setMessage(null);
    const response = await fetch(
      `${WORKSPACE_API_PATH}/projects/${project.slug}/branches/${activeBranch.slug}/publish`,
      { method: 'POST' },
    );
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
    setMessage(payload.error || payload.message || 'Promotion recorded');
    if (response.ok) {
      const refresh = await fetch(WORKSPACE_API_PATH, { cache: 'no-store' });
      const body = await refresh.json().catch(() => ({})) as { data?: WorkspaceOverview };
      setProject(body.data?.projects.find((entry) => entry.slug === project.slug) ?? project);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  if (!project) {
    return (
      <main className="min-h-dvh bg-background px-6 py-16 text-foreground">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button
          asChild className="mt-4"
          variant="outline"
        >
          <Link href="/projects">Back to projects</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-10">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Project</p>
            <h1 className="mt-1 text-xl font-medium">{project.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This project keeps its own branches and domains. Its canvas is separate from the live site, so it does not show another account&apos;s pages.
            </p>
          </div>
          <Button
            asChild variant="outline"
            size="sm"
          >
            <Link href="/projects">All projects</Link>
          </Button>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Branches</h2>
          <ul className="divide-y rounded-xl border">
            {project.branches.map((branch) => (
              <li key={branch.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <button
                  type="button"
                  className="min-w-0 truncate text-left"
                  onClick={() => {
                    writeActiveBranch(project.slug, branch.slug);
                    setActive(branch.slug);
                  }}
                >
                  {branch.name}
                  {branch.slug === active ? ' · current' : ''}
                </button>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{branch.kind}</Badge>
                  <Button
                    asChild size="sm"
                    variant="ghost"
                  >
                    <a href={branch.previewPath}>Preview</a>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {project.canEdit && (
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateBranch();
              }}
            >
              <Label htmlFor="new-branch" className="sr-only">Branch name</Label>
              <Input
                id="new-branch"
                value={branchName}
                onChange={(event) => setBranchName(event.target.value)}
                placeholder="New branch"
              />
              <Button
                type="submit" variant="outline"
                disabled={!branchName.trim()}
              >Create branch</Button>
              <Button
                type="button" onClick={() => void handlePromote()}
                disabled={!activeBranch}
              >
                Publish production
              </Button>
            </form>
          )}
          {activeBranch && (
            <p className="text-xs text-muted-foreground">
              Preview host {activeBranch.previewHost}. Publish records the promotion and does not ship the shared live canvas.
            </p>
          )}
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Domains</h2>
          <DomainManager slug={project.slug} canEdit={project.canEdit} />
        </section>
      </div>
    </main>
  );
}
