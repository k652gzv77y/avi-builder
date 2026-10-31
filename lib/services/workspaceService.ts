import { NextRequest } from 'next/server';

import { noCache } from '@/lib/api-response';
import { ensureCustomHostname } from '@/lib/cloudflare-domains';
import {
  interpretProbeError,
  interpretProbeResponse,
  normalizeHostname,
  type DomainRedirect,
} from '@/lib/domain-routing';
import { resolveRole } from '@/lib/roles';
import { readWorkspaceGraph, writeWorkspaceGraph } from '@/lib/repositories/workspaceRepository';
import { PROJECT_SLUG_HEADER, resolveProjectSlug } from '@/lib/project-url';
import { getAuthUser } from '@/lib/supabase-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  applyDomainProbe,
  attachDomain,
  canAccessProject,
  canEditProject,
  createAccount,
  createBranch,
  createProject,
  disconnectDomain,
  inviteProjectMember,
  prepareGraph,
  promoteBranch,
  toOverview,
  updateDomainRedirect,
  updateProject,
  WorkspaceError,
  type AccountRole,
  type ProjectStatus,
  type WorkspaceActor,
  type WorkspaceGraph,
  type WorkspaceOverview,
} from '@/lib/workspace';

const INVITE_ROLES: AccountRole[] = ['admin', 'editor', 'viewer'];
const REDIRECTS: DomainRedirect[] = ['none', 'apex-to-www', 'www-to-apex'];

export function projectSlugOf(request: NextRequest): string | null {
  return resolveProjectSlug({
    headerSlug: request.headers.get(PROJECT_SLUG_HEADER),
    querySlug: request.nextUrl.searchParams.get('project'),
    referer: request.headers.get('referer'),
  });
}

export function workspaceErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    const status = error.code === 'not_found'
      ? 404
      : error.code === 'forbidden'
        ? 403
        : error.code === 'conflict'
          ? 409
          : 400;
    return noCache({ error: error.message }, status);
  }
  console.error('[workspace]', error);
  const message = error instanceof Error ? error.message : 'Workspace request failed';
  return noCache({ error: message }, 500);
}

export async function getRequestActor(): Promise<WorkspaceActor | null> {
  const auth = await getAuthUser();
  if (!auth) return null;
  const raw = auth.user.app_metadata?.role;
  return {
    userId: auth.user.id,
    email: auth.user.email ?? '',
    appRole: resolveRole(typeof raw === 'string' ? raw : null),
  };
}

async function listBuilderUsers(): Promise<{ id: string; email: string }[] | null> {
  try {
    const client = await getSupabaseAdmin();
    if (!client) return null;
    const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error || !data?.users) return null;
    return data.users
      .map((user) => ({ id: user.id, email: user.email ?? '' }))
      .filter((user) => user.email);
  } catch (error) {
    console.error('[workspace] Could not list users for adoption:', error);
    return null;
  }
}

async function loadPrepared(actor: WorkspaceActor): Promise<WorkspaceGraph> {
  const now = new Date().toISOString();
  const current = await readWorkspaceGraph();
  const users = current.legacyAdopted ? null : await listBuilderUsers();
  const prepared = prepareGraph(current, actor, now, users);
  if (prepared.changed) await writeWorkspaceGraph(prepared.graph);
  return prepared.graph;
}

async function mutate(
  actor: WorkspaceActor,
  change: (graph: WorkspaceGraph) => WorkspaceGraph,
): Promise<WorkspaceGraph> {
  const graph = await loadPrepared(actor);
  const next = change(graph);
  if (next === graph) return graph;
  const saved = { ...next, revision: graph.revision + 1 };
  await writeWorkspaceGraph(saved);
  return saved;
}

export async function getWorkspaceOverview(actor: WorkspaceActor): Promise<WorkspaceOverview> {
  return toOverview(await loadPrepared(actor), actor);
}

export async function addAccount(actor: WorkspaceActor, name: string): Promise<WorkspaceOverview> {
  const graph = await mutate(actor, (current) => createAccount(current, actor, name, new Date().toISOString()).graph);
  return toOverview(graph, actor);
}

export async function addProject(actor: WorkspaceActor, accountId: string, name: string): Promise<WorkspaceOverview> {
  const graph = await mutate(actor, (current) => createProject(current, actor, accountId, name, new Date().toISOString()).graph);
  return toOverview(graph, actor);
}

export async function changeProject(
  actor: WorkspaceActor,
  slug: string,
  input: { name?: string; status?: ProjectStatus },
): Promise<WorkspaceOverview> {
  const graph = await mutate(actor, (current) => updateProject(current, actor, slug, input, new Date().toISOString()));
  return toOverview(graph, actor);
}

export async function addBranch(actor: WorkspaceActor, slug: string, name: string): Promise<WorkspaceOverview> {
  const graph = await mutate(actor, (current) => createBranch(current, actor, slug, name, new Date().toISOString()).graph);
  return toOverview(graph, actor);
}

export async function promoteBranchForActor(
  actor: WorkspaceActor,
  projectSlug: string,
  branchSlug: string,
): Promise<{ slug: string; branch: string; promoted: true }> {
  const graph = await loadPrepared(actor);
  if (!canEditProject(graph, actor, projectSlug)) {
    throw new WorkspaceError('forbidden', 'You cannot publish this project');
  }
  const next = promoteBranch(graph, projectSlug, branchSlug, new Date().toISOString());
  if (next === graph) throw new WorkspaceError('not_found', 'Branch not found');
  await writeWorkspaceGraph({ ...next, revision: graph.revision + 1 });
  return { slug: projectSlug, branch: branchSlug, promoted: true };
}

export async function recordBranchPromotion(projectSlug: string, branchSlug: string): Promise<boolean> {
  const graph = await readWorkspaceGraph();
  const next = promoteBranch(graph, projectSlug, branchSlug, new Date().toISOString());
  if (next === graph) return false;
  await writeWorkspaceGraph({ ...next, revision: graph.revision + 1 });
  return true;
}

export async function inviteMember(
  actor: WorkspaceActor,
  slug: string,
  email: string,
  role: AccountRole,
  redirectTo?: string,
): Promise<{ overview: WorkspaceOverview; invited: boolean; message: string }> {
  if (!INVITE_ROLES.includes(role)) throw new WorkspaceError('invalid', 'Choose admin, editor, or viewer');

  const graph = await mutate(actor, (current) => (
    inviteProjectMember(current, actor, slug, email, role, new Date().toISOString()).graph
  ));

  let invited = false;
  let message = 'Invite saved. They will see this project the next time they sign in.';
  try {
    const client = await getSupabaseAdmin();
    if (!client) {
      message = 'Invite saved. Supabase is not configured, so no email was sent.';
    } else {
      const assignRole = role === 'admin' ? 'admin' : 'editor';
      const { data, error } = await client.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirectTo || undefined,
        data: {
          invited_at: new Date().toISOString(),
          project_slug: slug,
        },
      });
      if (error) {
        const already = /already|registered|exists/i.test(error.message);
        message = already
          ? 'Invite saved. That email already has an account.'
          : `Invite saved. Email was not sent: ${error.message}`;
      } else {
        invited = true;
        message = `Invitation sent to ${email}`;
        if (data.user) {
          await client.auth.admin.updateUserById(data.user.id, {
            app_metadata: { role: assignRole },
          });
        }
      }
    }
  } catch (error) {
    console.error('[workspace] invite email failed:', error);
    message = 'Invite saved. The email could not be sent.';
  }

  return { overview: toOverview(graph, actor), invited, message };
}

export async function addDomain(
  actor: WorkspaceActor,
  projectSlug: string,
  hostname: string,
  redirect?: DomainRedirect,
) {
  if (redirect && !REDIRECTS.includes(redirect)) {
    throw new WorkspaceError('invalid', 'Unknown redirect');
  }
  let savedHostname = hostname;
  const graph = await mutate(actor, (current) => {
    const result = attachDomain(current, actor, projectSlug, hostname, redirect, new Date().toISOString());
    savedHostname = result.domain.hostname;
    return result.graph;
  });
  const cloudflare = await ensureCustomHostname(savedHostname);
  const overview = toOverview(graph, actor);
  const domain = overview.projects
    .find((project) => project.slug === projectSlug)
    ?.domains.find((entry) => entry.hostname === normalizeHostname(savedHostname)) ?? null;
  return { overview, domain, cloudflare };
}

export async function changeDomainRedirect(
  actor: WorkspaceActor,
  projectSlug: string,
  hostname: string,
  redirect: DomainRedirect,
): Promise<WorkspaceOverview> {
  if (!REDIRECTS.includes(redirect)) throw new WorkspaceError('invalid', 'Unknown redirect');
  const graph = await mutate(actor, (current) => updateDomainRedirect(current, actor, projectSlug, hostname, redirect));
  return toOverview(graph, actor);
}

export async function removeDomain(
  actor: WorkspaceActor,
  projectSlug: string,
  hostname: string,
): Promise<WorkspaceOverview> {
  const graph = await mutate(actor, (current) => (
    disconnectDomain(current, actor, projectSlug, hostname, new Date().toISOString())
  ));
  return toOverview(graph, actor);
}

export async function probeDomain(actor: WorkspaceActor, projectSlug: string, hostname: string) {
  const graph = await loadPrepared(actor);
  if (!canAccessProject(graph, actor, projectSlug)) {
    throw new WorkspaceError('forbidden', 'You cannot view this project');
  }
  const host = normalizeHostname(hostname);
  const domain = graph.domains.find((entry) => (
    entry.hostname === host && !entry.disconnectedAt
  ));
  if (!domain) throw new WorkspaceError('not_found', 'Domain not found');

  let probe: { status: 'pending' | 'live' | 'error'; sslStatus: 'pending' | 'active' | 'error' };
  let detail = '';
  try {
    const response = await fetch(`https://${host}`, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(4000),
    });
    probe = interpretProbeResponse(response.status);
    detail = `HTTPS responded ${response.status}`;
  } catch (error) {
    detail = error instanceof Error ? error.message : 'unreachable';
    probe = interpretProbeError(detail);
  }

  const next = applyDomainProbe(graph, projectSlug, host, probe);
  const saved = { ...next, revision: graph.revision + 1 };
  await writeWorkspaceGraph(saved);
  return { ...probe, detail, hostname: host };
}
