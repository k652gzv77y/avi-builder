/**
 * Account, project, branch, and domain control plane.
 *
 * The live canvas (pages, layers, CMS) stays on the legacy shared project.
 * Other accounts only see their own projects, and those projects do not
 * read or publish that canvas.
 */

import type { UserRole } from '@/lib/roles';
import { isReservedProjectSlug } from '@/lib/project-url';
import {
  classifyHostname,
  dnsChecklist,
  isAttachableHostname,
  isSlug,
  normalizeHostname,
  previewHostname,
  previewPath,
  type DnsRecord,
  type DomainKind,
  type DomainRedirect,
  type DomainStatus,
  type SslStatus,
} from '@/lib/domain-routing';

export const WORKSPACE_APP_ID = 'avi-workspace';
export const WORKSPACE_GRAPH_KEY = 'graph';
export const WORKSPACE_API_PATH = '/projects/workspace';
export const LEGACY_PROJECT_SLUG = 'kolbo-school';
export const LEGACY_PROJECT_NAME = 'Kolbo School';
export const ACTIVE_BRANCH_STORAGE_PREFIX = 'avi-active-branch:';
export const ACTIVE_BRANCH_EVENT = 'avi-active-branch';

export type AccountRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type ProjectStatus = 'active' | 'archived';
export type BranchKind = 'production' | 'staging' | 'draft';
export type ContentMode = 'shared' | 'metadata';
export type DomainManaged = 'platform' | 'custom';

export interface WorkspaceActor {
  userId: string;
  email: string;
  appRole: UserRole | null;
}

export interface WorkspaceAccount {
  id: string;
  name: string;
  slug: string;
  isLegacy: boolean;
  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  accountId: string;
  userId: string | null;
  email: string;
  role: AccountRole;
  status: 'active' | 'invited';
  projectId: string | null;
  invitedAt: string;
}

export interface WorkspaceProject {
  id: string;
  accountId: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  contentMode: ContentMode;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceBranch {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  kind: BranchKind;
  createdAt: string;
  publishedAt: string | null;
}

export interface WorkspaceDomain {
  id: string;
  projectId: string;
  hostname: string;
  kind: DomainKind;
  managed: DomainManaged;
  status: DomainStatus;
  sslStatus: SslStatus;
  redirect: DomainRedirect;
  disconnectedAt: string | null;
  createdAt: string;
}

export interface WorkspaceGraph {
  revision: number;
  legacyAdopted: boolean;
  accounts: WorkspaceAccount[];
  members: WorkspaceMember[];
  projects: WorkspaceProject[];
  branches: WorkspaceBranch[];
  domains: WorkspaceDomain[];
}

export interface BranchView {
  id: string;
  name: string;
  slug: string;
  kind: BranchKind;
  publishedAt: string | null;
  previewPath: string;
  previewHost: string;
}

export interface DomainView {
  id: string;
  hostname: string;
  kind: DomainKind;
  managed: DomainManaged;
  status: DomainStatus;
  sslStatus: SslStatus;
  redirect: DomainRedirect;
  checklist: DnsRecord[];
}

export interface MemberView {
  email: string;
  role: AccountRole;
  status: 'active' | 'invited';
}

export interface ProjectView {
  id: string;
  accountId: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  contentMode: ContentMode;
  updatedAt: string;
  canManage: boolean;
  canEdit: boolean;
  branches: BranchView[];
  domains: DomainView[];
  members: MemberView[];
}

export interface AccountView {
  id: string;
  name: string;
  slug: string;
  isLegacy: boolean;
  role: AccountRole | null;
}

export interface WorkspaceOverview {
  revision: number;
  accounts: AccountView[];
  projects: ProjectView[];
}

export class WorkspaceError extends Error {
  readonly code: 'not_found' | 'forbidden' | 'conflict' | 'invalid';

  constructor(code: WorkspaceError['code'], message: string) {
    super(message);
    this.name = 'WorkspaceError';
    this.code = code;
  }
}

export function createId(): string {
  return globalThis.crypto.randomUUID();
}

export function emptyGraph(): WorkspaceGraph {
  return {
    revision: 0,
    legacyAdopted: false,
    accounts: [],
    members: [],
    projects: [],
    branches: [],
    domains: [],
  };
}

export function slugifyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'project';
}

export function activeBranchStorageKey(projectSlug: string): string {
  return `${ACTIVE_BRANCH_STORAGE_PREFIX}${projectSlug}`;
}

export function resolveActiveBranchSlug(
  stored: string | null | undefined,
  branches: { slug: string; kind: BranchKind }[],
): string {
  if (stored && branches.some((branch) => branch.slug === stored)) return stored;
  return branches.find((branch) => branch.kind === 'staging')?.slug
    ?? branches.find((branch) => branch.kind !== 'production')?.slug
    ?? branches[0]?.slug
    ?? 'staging';
}

export function readActiveBranch(projectSlug: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(activeBranchStorageKey(projectSlug));
}

export function writeActiveBranch(projectSlug: string, branchSlug: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(activeBranchStorageKey(projectSlug), branchSlug);
  window.dispatchEvent(new CustomEvent(ACTIVE_BRANCH_EVENT, {
    detail: { projectSlug, branchSlug },
  }));
}

function emailsEqual(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function uniqueSlug(base: string, taken: Set<string>): string {
  let slug = base;
  if (isReservedProjectSlug(slug)) slug = `${slug}-project`;
  if (!taken.has(slug)) return slug;
  let index = 2;
  while (taken.has(`${slug}-${index}`)) index += 1;
  return `${slug}-${index}`;
}

function accountWideMember(graph: WorkspaceGraph, actor: WorkspaceActor, accountId: string): WorkspaceMember | null {
  return graph.members.find((member) => (
    member.accountId === accountId
    && member.projectId === null
    && member.status === 'active'
    && (member.userId === actor.userId || emailsEqual(member.email, actor.email))
  )) ?? null;
}

function memberRole(graph: WorkspaceGraph, actor: WorkspaceActor, accountId: string, projectId: string): AccountRole | null {
  const matches = graph.members.filter((member) => (
    member.accountId === accountId
    && member.status === 'active'
    && (member.projectId === null || member.projectId === projectId)
    && (member.userId === actor.userId || emailsEqual(member.email, actor.email))
  ));
  if (matches.length === 0) return null;
  const rank: Record<AccountRole, number> = { owner: 0, admin: 1, editor: 2, viewer: 3 };
  return matches.sort((a, b) => rank[a.role] - rank[b.role])[0]?.role ?? null;
}

export function accountIdsForActor(graph: WorkspaceGraph, actor: WorkspaceActor): string[] {
  const ids = new Set<string>();
  for (const member of graph.members) {
    if (member.status !== 'active') continue;
    if (member.userId === actor.userId || emailsEqual(member.email, actor.email)) {
      ids.add(member.accountId);
    }
  }
  return [...ids];
}

export function canAccessProject(graph: WorkspaceGraph, actor: WorkspaceActor, slug: string): boolean {
  const project = graph.projects.find((entry) => entry.slug === slug);
  if (!project) return false;
  return memberRole(graph, actor, project.accountId, project.id) !== null;
}

export function canEditProject(graph: WorkspaceGraph, actor: WorkspaceActor, slug: string): boolean {
  const project = graph.projects.find((entry) => entry.slug === slug);
  if (!project) return false;
  const role = memberRole(graph, actor, project.accountId, project.id);
  return role !== null && role !== 'viewer';
}

export function canManageProject(graph: WorkspaceGraph, actor: WorkspaceActor, slug: string): boolean {
  if (!canAccessProject(graph, actor, slug)) return false;
  if (actor.appRole === 'owner' || actor.appRole === 'admin') return true;
  const project = graph.projects.find((entry) => entry.slug === slug);
  if (!project) return false;
  const role = memberRole(graph, actor, project.accountId, project.id);
  return role === 'owner' || role === 'admin';
}

export function canCreateInAccount(graph: WorkspaceGraph, actor: WorkspaceActor, accountId: string): boolean {
  const membership = accountWideMember(graph, actor, accountId);
  if (!membership) return false;
  return membership.role !== 'viewer';
}

export function projectsForActor(graph: WorkspaceGraph, actor: WorkspaceActor, accountId: string): WorkspaceProject[] {
  if (!accountIdsForActor(graph, actor).includes(accountId)) return [];
  return graph.projects.filter((project) => (
    project.accountId === accountId && canAccessProject(graph, actor, project.slug)
  ));
}

const METADATA_API_PREFIXES = [
  '/editor/api/workspace',
  '/editor/api/domains',
  '/editor/api/supabase',
  '/editor/api/auth',
  '/editor/api/setup',
  '/editor/api/profile',
];

/** Content APIs stay on the shared canvas. Metadata projects may call workspace and domain routes only. */
export function isProjectContentApi(pathname: string): boolean {
  const normalized = pathname.replace(/^\/ycode\/api/, '/editor/api');
  if (!normalized.startsWith('/editor/api/')) return false;
  return !METADATA_API_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

export function usesSharedCanvas(graph: WorkspaceGraph | null, slug: string): boolean {
  if (!graph || graph.projects.length === 0) return slug === LEGACY_PROJECT_SLUG;
  const project = graph.projects.find((entry) => entry.slug === slug);
  if (!project) return false;
  return project.contentMode === 'shared';
}

export type ProjectRouteKind = 'editor' | 'space' | 'denied' | 'missing';

/**
 * Where `/projects/:slug` should render.
 * Logged-out visitors still reach the shared editor so the sign-in form can
 * mount. Membership is enforced on APIs after the legacy team is adopted.
 */
export function resolveProjectRoute(
  graph: WorkspaceGraph | null,
  actor: WorkspaceActor | null,
  slug: string,
): ProjectRouteKind {
  if (!graph || graph.projects.length === 0) {
    return slug === LEGACY_PROJECT_SLUG ? 'editor' : 'missing';
  }
  const project = graph.projects.find((entry) => entry.slug === slug);
  if (!project) return 'missing';
  if (actor && graph.legacyAdopted && !canAccessProject(graph, actor, slug)) return 'denied';
  if (project.status === 'archived') return 'space';
  return project.contentMode === 'shared' ? 'editor' : 'space';
}

function branchView(project: WorkspaceProject, branch: WorkspaceBranch): BranchView {
  return {
    id: branch.id,
    name: branch.name,
    slug: branch.slug,
    kind: branch.kind,
    publishedAt: branch.publishedAt,
    previewPath: previewPath(project.slug, branch.slug),
    previewHost: previewHostname(branch.slug, project.slug),
  };
}

function domainView(domain: WorkspaceDomain): DomainView {
  return {
    id: domain.id,
    hostname: domain.hostname,
    kind: domain.kind,
    managed: domain.managed,
    status: domain.status,
    sslStatus: domain.sslStatus,
    redirect: domain.redirect,
    checklist: domain.managed === 'custom' && !domain.disconnectedAt
      ? dnsChecklist(domain.hostname, domain.kind)
      : [],
  };
}

export function toOverview(graph: WorkspaceGraph, actor: WorkspaceActor): WorkspaceOverview {
  const accountIds = new Set(accountIdsForActor(graph, actor));
  const accounts = graph.accounts
    .filter((account) => accountIds.has(account.id))
    .map((account) => ({
      id: account.id,
      name: account.name,
      slug: account.slug,
      isLegacy: account.isLegacy,
      role: accountWideMember(graph, actor, account.id)?.role ?? null,
    }));

  const projects = graph.projects
    .filter((project) => accountIds.has(project.accountId) && canAccessProject(graph, actor, project.slug))
    .map((project) => ({
      id: project.id,
      accountId: project.accountId,
      name: project.name,
      slug: project.slug,
      status: project.status,
      contentMode: project.contentMode,
      updatedAt: project.updatedAt,
      canManage: canManageProject(graph, actor, project.slug),
      canEdit: canEditProject(graph, actor, project.slug),
      branches: graph.branches
        .filter((branch) => branch.projectId === project.id)
        .map((branch) => branchView(project, branch)),
      domains: graph.domains
        .filter((domain) => domain.projectId === project.id && !domain.disconnectedAt)
        .map(domainView),
      members: graph.members
        .filter((member) => member.accountId === project.accountId && (member.projectId === null || member.projectId === project.id))
        .map((member) => ({ email: member.email, role: member.role, status: member.status })),
    }));

  return { revision: graph.revision, accounts, projects };
}

function requireProject(graph: WorkspaceGraph, slug: string): WorkspaceProject {
  const project = graph.projects.find((entry) => entry.slug === slug);
  if (!project) throw new WorkspaceError('not_found', 'Project not found');
  return project;
}

export function seedLegacyWorkspace(actor: WorkspaceActor, now: string): WorkspaceGraph {
  const accountId = createId();
  const projectId = createId();
  const graph = emptyGraph();
  graph.accounts.push({
    id: accountId,
    name: 'Personal',
    slug: 'personal',
    isLegacy: true,
    createdAt: now,
  });
  graph.members.push({
    id: createId(),
    accountId,
    userId: actor.userId,
    email: normalizeEmail(actor.email),
    role: 'owner',
    status: 'active',
    projectId: null,
    invitedAt: now,
  });
  graph.projects.push({
    id: projectId,
    accountId,
    name: LEGACY_PROJECT_NAME,
    slug: LEGACY_PROJECT_SLUG,
    status: 'active',
    contentMode: 'shared',
    createdAt: now,
    updatedAt: now,
  });
  graph.branches.push(
    {
      id: createId(),
      projectId,
      name: 'Production',
      slug: 'production',
      kind: 'production',
      createdAt: now,
      publishedAt: null,
    },
    {
      id: createId(),
      projectId,
      name: 'Staging',
      slug: 'staging',
      kind: 'staging',
      createdAt: now,
      publishedAt: null,
    },
  );
  const seededDomains: Array<Pick<WorkspaceDomain, 'hostname' | 'kind' | 'managed' | 'status' | 'sslStatus' | 'redirect'>> = [
    { hostname: 'kolbo-school.avibuilder.com', kind: 'subdomain', managed: 'platform', status: 'live', sslStatus: 'active', redirect: 'none' },
    { hostname: 'kolboschool.com', kind: 'apex', managed: 'custom', status: 'live', sslStatus: 'active', redirect: 'none' },
    { hostname: 'www.kolboschool.com', kind: 'www', managed: 'custom', status: 'live', sslStatus: 'active', redirect: 'www-to-apex' },
    { hostname: 'beta.kolboschool.com', kind: 'subdomain', managed: 'custom', status: 'live', sslStatus: 'active', redirect: 'none' },
  ];
  for (const domain of seededDomains) {
    graph.domains.push({
      id: createId(),
      projectId,
      disconnectedAt: null,
      createdAt: now,
      ...domain,
    });
  }
  return graph;
}

export function ensureActor(graph: WorkspaceGraph, actor: WorkspaceActor, now: string): WorkspaceGraph {
  if (!actor.userId) return graph;
  if (graph.accounts.length === 0) return seedLegacyWorkspace(actor, now);
  if (accountIdsForActor(graph, actor).length > 0) return graph;
  return createAccount(graph, actor, 'Personal', now).graph;
}

export function adoptExistingUsers(
  graph: WorkspaceGraph,
  users: { id: string; email: string }[],
  now: string,
): WorkspaceGraph {
  const legacy = graph.accounts.find((account) => account.isLegacy);
  if (!legacy) return { ...graph, legacyAdopted: true };
  const members = graph.members.map((member) => {
    if (member.userId || member.accountId !== legacy.id) return member;
    const match = users.find((user) => emailsEqual(user.email, member.email));
    return match ? { ...member, userId: match.id } : member;
  });
  for (const user of users) {
    const email = normalizeEmail(user.email);
    if (!email) continue;
    const exists = members.some((member) => (
      member.accountId === legacy.id
      && member.projectId === null
      && (member.userId === user.id || emailsEqual(member.email, email))
    ));
    if (exists) continue;
    members.push({
      id: createId(),
      accountId: legacy.id,
      userId: user.id,
      email,
      role: 'editor',
      status: 'active',
      projectId: null,
      invitedAt: now,
    });
  }
  return { ...graph, legacyAdopted: true, members };
}

export function claimInvites(graph: WorkspaceGraph, actor: WorkspaceActor): WorkspaceGraph {
  if (!actor.email) return graph;
  let changed = false;
  const members = graph.members.map((member) => {
    if (member.userId === actor.userId) return member;
    if (!emailsEqual(member.email, actor.email)) return member;
    changed = true;
    return { ...member, userId: actor.userId, status: 'active' as const };
  });
  if (!changed) return graph;
  return { ...graph, members };
}

export function prepareGraph(
  graph: WorkspaceGraph,
  actor: WorkspaceActor,
  now: string,
  existingUsers: { id: string; email: string }[] | null,
): { graph: WorkspaceGraph; changed: boolean } {
  let next = graph;
  let changed = false;
  const ensured = ensureActor(next, actor, now);
  if (ensured !== next) {
    next = ensured;
    changed = true;
  }
  if (existingUsers && !next.legacyAdopted) {
    next = adoptExistingUsers(next, existingUsers, now);
    changed = true;
  }
  const claimed = claimInvites(next, actor);
  if (claimed !== next) {
    next = claimed;
    changed = true;
  }
  if (!changed) return { graph, changed: false };
  return { graph: { ...next, revision: graph.revision + 1 }, changed: true };
}

export function createAccount(
  graph: WorkspaceGraph,
  actor: WorkspaceActor,
  name: string,
  now: string,
): { graph: WorkspaceGraph; account: WorkspaceAccount } {
  const trimmed = name.trim();
  if (!trimmed) throw new WorkspaceError('invalid', 'Account name is required');
  const taken = new Set(graph.accounts.map((account) => account.slug));
  const account: WorkspaceAccount = {
    id: createId(),
    name: trimmed,
    slug: uniqueSlug(slugifyName(trimmed), taken),
    isLegacy: false,
    createdAt: now,
  };
  return {
    account,
    graph: {
      ...graph,
      accounts: [...graph.accounts, account],
      members: [
        ...graph.members,
        {
          id: createId(),
          accountId: account.id,
          userId: actor.userId,
          email: normalizeEmail(actor.email),
          role: 'owner',
          status: 'active',
          projectId: null,
          invitedAt: now,
        },
      ],
    },
  };
}

function defaultBranches(projectId: string, now: string): WorkspaceBranch[] {
  return [
    {
      id: createId(),
      projectId,
      name: 'Production',
      slug: 'production',
      kind: 'production',
      createdAt: now,
      publishedAt: null,
    },
    {
      id: createId(),
      projectId,
      name: 'Staging',
      slug: 'staging',
      kind: 'staging',
      createdAt: now,
      publishedAt: null,
    },
  ];
}

export function createProject(
  graph: WorkspaceGraph,
  actor: WorkspaceActor,
  accountId: string,
  name: string,
  now: string,
): { graph: WorkspaceGraph; project: WorkspaceProject } {
  const trimmed = name.trim();
  if (!trimmed) throw new WorkspaceError('invalid', 'Project name is required');
  if (!graph.accounts.some((account) => account.id === accountId)) {
    throw new WorkspaceError('not_found', 'Account not found');
  }
  if (!canCreateInAccount(graph, actor, accountId)) {
    throw new WorkspaceError('forbidden', 'You cannot create a project on this account');
  }
  const taken = new Set(graph.projects.map((project) => project.slug));
  const project: WorkspaceProject = {
    id: createId(),
    accountId,
    name: trimmed,
    slug: uniqueSlug(slugifyName(trimmed), taken),
    status: 'active',
    contentMode: 'metadata',
    createdAt: now,
    updatedAt: now,
  };
  return {
    project,
    graph: {
      ...graph,
      projects: [...graph.projects, project],
      branches: [...graph.branches, ...defaultBranches(project.id, now)],
    },
  };
}

export function updateProject(
  graph: WorkspaceGraph,
  actor: WorkspaceActor,
  slug: string,
  input: { name?: string; status?: ProjectStatus },
  now: string,
): WorkspaceGraph {
  const project = requireProject(graph, slug);
  if (!canManageProject(graph, actor, slug)) {
    throw new WorkspaceError('forbidden', 'You cannot change this project');
  }
  const name = input.name?.trim();
  if (input.name !== undefined && !name) throw new WorkspaceError('invalid', 'Project name is required');
  return {
    ...graph,
    projects: graph.projects.map((entry) => (
      entry.id === project.id
        ? {
          ...entry,
          name: name || entry.name,
          status: input.status ?? entry.status,
          updatedAt: now,
        }
        : entry
    )),
  };
}

export function inviteProjectMember(
  graph: WorkspaceGraph,
  actor: WorkspaceActor,
  slug: string,
  email: string,
  role: AccountRole,
  now: string,
): { graph: WorkspaceGraph; member: WorkspaceMember } {
  const project = requireProject(graph, slug);
  if (!canManageProject(graph, actor, slug)) {
    throw new WorkspaceError('forbidden', 'You cannot invite people to this project');
  }
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new WorkspaceError('invalid', 'Invalid email');
  }
  if (role === 'owner') throw new WorkspaceError('invalid', 'Transfer ownership from the account owner');
  const existing = graph.members.find((member) => (
    member.accountId === project.accountId
    && member.projectId === project.id
    && emailsEqual(member.email, normalized)
  ));
  if (existing) throw new WorkspaceError('conflict', 'That person is already on this project');
  const member: WorkspaceMember = {
    id: createId(),
    accountId: project.accountId,
    userId: null,
    email: normalized,
    role,
    status: 'invited',
    projectId: project.id,
    invitedAt: now,
  };
  return { member, graph: { ...graph, members: [...graph.members, member] } };
}

export function createBranch(
  graph: WorkspaceGraph,
  actor: WorkspaceActor,
  slug: string,
  name: string,
  now: string,
): { graph: WorkspaceGraph; branch: WorkspaceBranch } {
  const project = requireProject(graph, slug);
  if (!canEditProject(graph, actor, slug)) {
    throw new WorkspaceError('forbidden', 'You cannot create a branch on this project');
  }
  const trimmed = name.trim();
  if (!trimmed) throw new WorkspaceError('invalid', 'Branch name is required');
  const branchSlug = slugifyName(trimmed);
  if (!isSlug(branchSlug) || branchSlug.includes('--')) {
    throw new WorkspaceError('invalid', 'Branch name needs letters or numbers');
  }
  const taken = graph.branches.some((branch) => branch.projectId === project.id && branch.slug === branchSlug);
  if (taken) throw new WorkspaceError('conflict', 'A branch with that name already exists');
  if (branchSlug === 'production') {
    throw new WorkspaceError('conflict', 'Production already exists');
  }
  const branch: WorkspaceBranch = {
    id: createId(),
    projectId: project.id,
    name: trimmed,
    slug: branchSlug,
    kind: 'draft',
    createdAt: now,
    publishedAt: null,
  };
  return { branch, graph: { ...graph, branches: [...graph.branches, branch] } };
}

export function promoteBranch(
  graph: WorkspaceGraph,
  projectSlug: string,
  branchSlug: string,
  now: string,
): WorkspaceGraph {
  const project = graph.projects.find((entry) => entry.slug === projectSlug);
  if (!project) return graph;
  const branch = graph.branches.find((entry) => entry.projectId === project.id && entry.slug === branchSlug);
  if (!branch) return graph;
  return {
    ...graph,
    branches: graph.branches.map((entry) => {
      if (entry.projectId !== project.id) return entry;
      if (entry.id === branch.id || entry.kind === 'production') {
        return { ...entry, publishedAt: now };
      }
      return entry;
    }),
  };
}

function oppositeRedirect(redirect: DomainRedirect): DomainRedirect | null {
  if (redirect === 'www-to-apex') return 'apex-to-www';
  if (redirect === 'apex-to-www') return 'www-to-apex';
  return null;
}

function pairedHostname(hostname: string, redirect: DomainRedirect): string | null {
  if (redirect === 'apex-to-www') return `www.${hostname}`;
  if (redirect === 'www-to-apex' && hostname.startsWith('www.')) return hostname.slice(4);
  return null;
}

export function attachDomain(
  graph: WorkspaceGraph,
  actor: WorkspaceActor,
  projectSlug: string,
  hostnameInput: string,
  redirect: DomainRedirect | undefined,
  now: string,
): { graph: WorkspaceGraph; domain: WorkspaceDomain } {
  const project = requireProject(graph, projectSlug);
  if (!canEditProject(graph, actor, projectSlug)) {
    throw new WorkspaceError('forbidden', 'You cannot attach a domain to this project');
  }
  const hostname = normalizeHostname(hostnameInput);
  if (!isAttachableHostname(hostname)) {
    throw new WorkspaceError('invalid', 'Enter a hostname you control, not the builder host');
  }
  const existing = graph.domains.find((domain) => domain.hostname === hostname);
  if (existing && !existing.disconnectedAt) {
    throw new WorkspaceError('conflict', 'That domain is already attached');
  }
  const kind = classifyHostname(hostname);
  const domain: WorkspaceDomain = {
    id: existing?.id ?? createId(),
    projectId: project.id,
    hostname,
    kind,
    managed: 'custom',
    status: 'pending',
    sslStatus: 'pending',
    redirect: redirect ?? (kind === 'www' ? 'www-to-apex' : 'none'),
    disconnectedAt: null,
    createdAt: existing?.createdAt ?? now,
  };
  const without = graph.domains.filter((entry) => entry.hostname !== hostname);
  const cleared = clearOppositeRedirects(without, project.id, domain.hostname, domain.redirect);
  return { domain, graph: { ...graph, domains: [...cleared, domain] } };
}

function clearOppositeRedirects(
  domains: WorkspaceDomain[],
  projectId: string,
  hostname: string,
  redirect: DomainRedirect,
): WorkspaceDomain[] {
  const opposite = oppositeRedirect(redirect);
  const pair = pairedHostname(hostname, redirect);
  if (!opposite || !pair) return domains;
  return domains.map((domain) => (
    domain.projectId === projectId && domain.hostname === pair && domain.redirect === opposite
      ? { ...domain, redirect: 'none' }
      : domain
  ));
}

export function updateDomainRedirect(
  graph: WorkspaceGraph,
  actor: WorkspaceActor,
  projectSlug: string,
  hostnameInput: string,
  redirect: DomainRedirect,
): WorkspaceGraph {
  const project = requireProject(graph, projectSlug);
  if (!canEditProject(graph, actor, projectSlug)) {
    throw new WorkspaceError('forbidden', 'You cannot change this domain');
  }
  const hostname = normalizeHostname(hostnameInput);
  const domain = graph.domains.find((entry) => entry.hostname === hostname && entry.projectId === project.id && !entry.disconnectedAt);
  if (!domain) throw new WorkspaceError('not_found', 'Domain not found');
  const updated = graph.domains.map((entry) => (
    entry.id === domain.id ? { ...entry, redirect } : entry
  ));
  return { ...graph, domains: clearOppositeRedirects(updated, project.id, hostname, redirect) };
}

export function disconnectDomain(
  graph: WorkspaceGraph,
  actor: WorkspaceActor,
  projectSlug: string,
  hostnameInput: string,
  now: string,
): WorkspaceGraph {
  const project = requireProject(graph, projectSlug);
  if (!canEditProject(graph, actor, projectSlug)) {
    throw new WorkspaceError('forbidden', 'You cannot disconnect this domain');
  }
  const hostname = normalizeHostname(hostnameInput);
  const domain = graph.domains.find((entry) => entry.hostname === hostname && entry.projectId === project.id && !entry.disconnectedAt);
  if (!domain) throw new WorkspaceError('not_found', 'Domain not found');
  if (domain.managed === 'platform') {
    throw new WorkspaceError('invalid', 'The builder preview host stays attached');
  }
  return {
    ...graph,
    domains: graph.domains.map((entry) => (
      entry.id === domain.id
        ? { ...entry, disconnectedAt: now, status: 'pending', sslStatus: 'pending', redirect: 'none' }
        : entry
    )),
  };
}

export function applyDomainProbe(
  graph: WorkspaceGraph,
  projectSlug: string,
  hostnameInput: string,
  probe: { status: DomainStatus; sslStatus: SslStatus },
): WorkspaceGraph {
  const project = graph.projects.find((entry) => entry.slug === projectSlug);
  if (!project) return graph;
  const hostname = normalizeHostname(hostnameInput);
  return {
    ...graph,
    domains: graph.domains.map((domain) => (
      domain.projectId === project.id && domain.hostname === hostname && !domain.disconnectedAt
        ? { ...domain, status: probe.status, sslStatus: probe.sslStatus }
        : domain
    )),
  };
}

export function routableDomains(graph: WorkspaceGraph): { hostname: string; projectSlug: string; redirect: DomainRedirect; disconnectedAt: string | null }[] {
  return graph.domains.flatMap((domain) => {
    const project = graph.projects.find((entry) => entry.id === domain.projectId);
    if (!project) return [];
    return [{
      hostname: domain.hostname,
      projectSlug: project.slug,
      redirect: domain.redirect,
      disconnectedAt: domain.disconnectedAt,
    }];
  });
}
