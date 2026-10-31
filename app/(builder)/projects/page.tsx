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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AUTH_ERROR_PARAM } from '@/lib/auth-flow';
import { rememberProjectSlug } from '@/lib/project-url';
import {
  LEGACY_PROJECT_SLUG,
  WORKSPACE_API_PATH,
  type AccountRole,
  type ProjectView,
  type WorkspaceOverview,
} from '@/lib/workspace';
import { useAuthStore } from '@/stores/useAuthStore';

const ACCOUNT_STORAGE_KEY = 'avi-active-account';

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
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ProjectView | null>(null);
  const [inviteTarget, setInviteTarget] = useState<ProjectView | null>(null);
  const [draftName, setDraftName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AccountRole>('editor');
  const [busy, setBusy] = useState(false);

  rememberProjectSlug(LEGACY_PROJECT_SLUG);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (initialized && !user) {
      const params = new URLSearchParams(window.location.search);
      const authError = params.get(AUTH_ERROR_PARAM);
      const target = authError
        ? `/projects/${LEGACY_PROJECT_SLUG}?${AUTH_ERROR_PARAM}=${encodeURIComponent(authError)}`
        : `/projects/${LEGACY_PROJECT_SLUG}`;
      router.replace(target);
    }
  }, [initialized, router, user]);

  async function loadWorkspace() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(WORKSPACE_API_PATH, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { data?: WorkspaceOverview; error?: string };
      if (!response.ok || !payload.data) {
        setError(payload.error || 'Could not load accounts');
        return;
      }
      setOverview(payload.data);
      const stored = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
      const fallback = payload.data.accounts.find((account) => account.isLegacy)?.id
        ?? payload.data.accounts[0]?.id
        ?? null;
      const nextAccount = payload.data.accounts.some((account) => account.id === stored) ? stored : fallback;
      setAccountId(nextAccount);
      const first = payload.data.projects.find((project) => project.status === 'active');
      if (first) rememberProjectSlug(first.slug);
    } catch {
      setError('Could not load accounts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    void loadWorkspace();
  }, [user]);

  function selectAccount(id: string) {
    setAccountId(id);
    window.localStorage.setItem(ACCOUNT_STORAGE_KEY, id);
  }

  const account = overview?.accounts.find((entry) => entry.id === accountId) ?? null;
  const editorSlug = overview?.projects.find((project) => (
    project.accountId === accountId && project.status === 'active' && project.contentMode === 'shared'
  ))?.slug
    ?? overview?.projects.find((project) => project.accountId === accountId && project.status === 'active')?.slug
    ?? LEGACY_PROJECT_SLUG;
  const projects = useMemo(() => {
    const list = overview?.projects.filter((project) => project.accountId === accountId) ?? [];
    return list.filter((project) => {
      if (!showArchived && project.status === 'archived') return false;
      if (showArchived && project.status !== 'archived') return false;
      return project.name.toLowerCase().includes(query.trim().toLowerCase());
    });
  }, [accountId, overview, query, showArchived]);

  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json().catch(() => ({})) as {
        data?: WorkspaceOverview;
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        setNotice(payload.error || 'Request failed');
        return false;
      }
      if (payload.data) setOverview(payload.data);
      if (payload.message) setNotice(payload.message);
      return true;
    } catch {
      setNotice('Request failed');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openProject(slug: string) {
    rememberProjectSlug(slug);
    router.push(`/projects/${slug}`);
  }

  if (!initialized || !user) {
    return <div className="min-h-dvh bg-background" />;
  }

  const initial = (account?.name || user.email || 'A').trim().charAt(0).toUpperCase();

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto grid min-h-dvh max-w-[1600px] grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="relative border-b border-border px-4 py-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between lg:block">
            <Link href="/projects" className="inline-flex items-center gap-2.5 text-sm font-medium">
              <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
                <AviBuilderMark className="h-5 w-5 min-h-5 min-w-5" />
              </span>
              AVI Builder
            </Link>
          </div>

          <nav className="mt-8 hidden space-y-1 lg:block" aria-label="Workspace">
            <Link href="/projects" className="flex h-8 items-center gap-2 rounded-md bg-secondary px-2.5 text-xs font-medium text-foreground">
              <FolderKanban className="size-3.5" />
              Projects
            </Link>
            <Link href={`/projects/${editorSlug}`} className="flex h-8 items-center gap-2 rounded-md px-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <PanelTop className="size-3.5" />
              Editor
            </Link>
          </nav>

          <div className="mt-6 border-t border-border pt-4 lg:mt-8">
            <p className="px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Account</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="mt-2 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-foreground/80 hover:bg-secondary">
                  <span className="flex size-5 items-center justify-center rounded bg-blue-400 text-[10px] font-semibold text-black">{initial}</span>
                  <span className="min-w-0 flex-1 truncate">{account?.name ?? 'Personal'}</span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {overview?.accounts.map((entry) => (
                  <DropdownMenuItem key={entry.id} onSelect={() => selectAccount(entry.id)}>
                    {entry.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onSelect={() => { setDraftName(''); setAccountOpen(true); }}>
                  New account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-8 hidden lg:block lg:absolute lg:bottom-4">
            <Link href={`/projects/${editorSlug}/profile`} className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-[9px] font-semibold text-foreground">{initial}</span>
              <span className="max-w-32 truncate">{user.email ?? 'Account'}</span>
            </Link>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-7 sm:py-7 lg:px-10 lg:py-9">
          <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{account?.name ?? 'Personal'} account</p>
              <h1 className="mt-1 text-xl font-medium tracking-normal text-foreground">Projects</h1>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <div className="relative min-w-0 flex-1 sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search projects"
                  className="h-8 border-border bg-secondary/40 pl-8 text-xs placeholder:text-muted-foreground"
                />
              </div>
              <Button
                size="sm" onClick={() => { setDraftName(''); setCreateOpen(true); }}
                disabled={!accountId}
              >
                New project
              </Button>
            </div>
          </header>

          <div className="flex items-center justify-between pt-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <button
                type="button" className={showArchived ? '' : 'font-medium text-foreground'}
                onClick={() => setShowArchived(false)}
              >All projects</button>
              <button
                type="button" className={showArchived ? 'font-medium text-foreground' : ''}
                onClick={() => setShowArchived(true)}
              >Archived</button>
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{projects.length}</span>
            </div>
          </div>

          {error && (
            <p className="mt-4 text-xs text-amber-500">{error} The live project is still available below.</p>
          )}
          {notice && <p className="mt-4 text-xs text-muted-foreground">{notice}</p>}

          {loading && !overview ? (
            <div className="mt-10"><Spinner /></div>
          ) : projects.length > 0 ? (
            <div className="mt-4 grid max-w-5xl gap-4 sm:grid-cols-2">
              {projects.map((project) => (
                <article key={project.id} className="group overflow-hidden border border-border bg-card text-card-foreground">
                  <button
                    type="button" className="block w-full text-left"
                    onClick={() => openProject(project.slug)}
                  >
                    <ProjectPreview />
                  </button>
                  <div className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <button
                        type="button" className="block truncate text-left text-sm font-medium hover:underline"
                        onClick={() => openProject(project.slug)}
                      >
                        {project.name}
                      </button>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Clock3 className="size-3" /> {project.branches.length} branches</span>
                        <span className="inline-flex items-center gap-1"><FileText className="size-3" /> {project.domains.length} domains</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost" size="sm"
                            aria-label={`Actions for ${project.name}`}
                          >Edit</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {project.canManage && (
                            <DropdownMenuItem onSelect={() => { setRenameTarget(project); setDraftName(project.name); }}>
                              Rename
                            </DropdownMenuItem>
                          )}
                          {project.canManage && (
                            <DropdownMenuItem onSelect={() => { setInviteTarget(project); setInviteEmail(''); setInviteRole('editor'); }}>
                              Invite
                            </DropdownMenuItem>
                          )}
                          {project.canManage && project.status === 'active' && (
                            <DropdownMenuItem onSelect={() => void mutate(`${WORKSPACE_API_PATH}/projects/${project.slug}`, 'PATCH', { status: 'archived' })}>
                              Archive
                            </DropdownMenuItem>
                          )}
                          {project.canManage && project.status === 'archived' && (
                            <DropdownMenuItem onSelect={() => void mutate(`${WORKSPACE_API_PATH}/projects/${project.slug}`, 'PATCH', { status: 'active' })}>
                              Restore
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost" size="icon-sm"
                            aria-label={`Open ${project.name}`} onClick={() => openProject(project.slug)}
                          >
                            <ArrowUpRight />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Open project</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 max-w-[520px] border border-dashed border-border px-5 py-12 text-center text-xs text-muted-foreground">
              {query.trim() ? `No projects match "${query}".` : showArchived ? 'No archived projects.' : 'No projects on this account yet.'}
            </div>
          )}

          {error && (
            <article className="mt-4 max-w-[520px] overflow-hidden border border-border bg-card">
              <Link href={`/projects/${LEGACY_PROJECT_SLUG}`} className="block"><ProjectPreview /></Link>
              <div className="p-4 text-sm font-medium">Kolbo School</div>
            </article>
          )}
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name" value={draftName}
              onChange={(event) => setDraftName(event.target.value)} placeholder="Project name"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost" size="sm"
              onClick={() => setCreateOpen(false)}
            >Cancel</Button>
            <Button
              size="sm"
              disabled={busy || !draftName.trim() || !accountId}
              onClick={() => void (async () => {
                const ok = await mutate(`${WORKSPACE_API_PATH}/projects`, 'POST', { accountId, name: draftName.trim() });
                if (!ok || !overview) return;
                setCreateOpen(false);
              })()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New account</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name" value={draftName}
              onChange={(event) => setDraftName(event.target.value)} placeholder="Studio"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost" size="sm"
              onClick={() => setAccountOpen(false)}
            >Cancel</Button>
            <Button
              size="sm"
              disabled={busy || !draftName.trim()}
              onClick={() => void (async () => {
                const response = await fetch(`${WORKSPACE_API_PATH}/accounts`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: draftName.trim() }),
                });
                const payload = await response.json().catch(() => ({})) as { data?: WorkspaceOverview; error?: string };
                if (!response.ok || !payload.data) {
                  setNotice(payload.error || 'Could not create the account');
                  return;
                }
                setOverview(payload.data);
                const created = payload.data.accounts.find((entry) => entry.name === draftName.trim() && !entry.isLegacy);
                if (created) selectAccount(created.id);
                setAccountOpen(false);
              })()}
            >
              Create account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename project</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rename-project">Name</Label>
            <Input
              id="rename-project" value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost" size="sm"
              onClick={() => setRenameTarget(null)}
            >Cancel</Button>
            <Button
              size="sm"
              disabled={busy || !draftName.trim() || !renameTarget}
              onClick={() => void (async () => {
                if (!renameTarget) return;
                const ok = await mutate(`${WORKSPACE_API_PATH}/projects/${renameTarget.slug}`, 'PATCH', { name: draftName.trim() });
                if (ok) setRenameTarget(null);
              })()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!inviteTarget} onOpenChange={(open) => { if (!open) setInviteTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite to {inviteTarget?.name}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email" type="email"
                value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as AccountRole)}>
                <SelectTrigger aria-label="Role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteTarget && inviteTarget.members.length > 0 && (
              <ul className="text-xs text-muted-foreground">
                {inviteTarget.members.map((member) => (
                  <li key={`${member.email}-${member.role}`}>{member.email} · {member.role} · {member.status}</li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost" size="sm"
              onClick={() => setInviteTarget(null)}
            >Cancel</Button>
            <Button
              size="sm"
              disabled={busy || !inviteEmail.trim() || !inviteTarget}
              onClick={() => void (async () => {
                if (!inviteTarget) return;
                const ok = await mutate(`${WORKSPACE_API_PATH}/projects/${inviteTarget.slug}/members`, 'POST', {
                  email: inviteEmail.trim(),
                  role: inviteRole,
                  redirectTo: `${window.location.origin}/projects/${inviteTarget.slug}`,
                });
                if (ok) setInviteTarget(null);
              })()}
            >
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
