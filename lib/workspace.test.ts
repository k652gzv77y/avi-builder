import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adoptExistingUsers,
  attachDomain,
  canAccessProject,
  createAccount,
  createBranch,
  createProject,
  disconnectDomain,
  inviteProjectMember,
  prepareGraph,
  promoteBranch,
  resolveActiveBranchSlug,
  resolveProjectRoute,
  seedLegacyWorkspace,
  toOverview,
  updateDomainRedirect,
  updateProject,
  isProjectContentApi,
  usesSharedCanvas,
  type WorkspaceActor,
} from '@/lib/workspace';
import { emptyGraph } from '@/lib/workspace';
import { redirectLocation } from '@/lib/domain-routing';
import { routableDomains } from '@/lib/workspace';

const NOW = '2026-10-31T00:00:00.000Z';

const owner: WorkspaceActor = { userId: 'user-a', email: 'Seth@Avi.test', appRole: 'owner' };
const designer: WorkspaceActor = { userId: 'user-b', email: 'designer@avi.test', appRole: 'designer' };

test('a private account does not leak projects to another account', () => {
  let graph = seedLegacyWorkspace(owner, NOW);
  const createdAccount = createAccount(graph, designer, 'Studio B', NOW);
  graph = createdAccount.graph;
  const secret = createProject(graph, designer, createdAccount.account.id, 'Secret Site', NOW);
  graph = secret.graph;

  const ownerView = toOverview(graph, owner);
  const designerView = toOverview(graph, designer);

  assert.equal(ownerView.projects.some((project) => project.slug === 'secret-site'), false);
  assert.equal(designerView.projects.some((project) => project.slug === 'secret-site'), true);
  assert.equal(canAccessProject(graph, designer, 'kolbo-school'), false);
  assert.equal(designerView.projects.some((project) => project.slug === 'kolbo-school'), false);
  assert.equal(ownerView.projects.some((project) => project.slug === 'kolbo-school'), true);

  graph = adoptExistingUsers(graph, [{ id: designer.userId, email: designer.email }], NOW);
  assert.equal(canAccessProject(graph, designer, 'kolbo-school'), true);
  assert.equal(toOverview(graph, owner).projects.some((project) => project.slug === 'secret-site'), false);
});

test('prepare seeds the legacy site once and adopts the current team', () => {
  const first = prepareGraph(emptyGraph(), owner, NOW, [
    { id: owner.userId, email: owner.email },
    { id: designer.userId, email: designer.email },
  ]);
  assert.equal(first.changed, true);
  assert.equal(first.graph.legacyAdopted, true);
  assert.equal(first.graph.projects[0]?.slug, 'kolbo-school');
  assert.equal(first.graph.projects[0]?.contentMode, 'shared');
  assert.equal(canAccessProject(first.graph, designer, 'kolbo-school'), true);

  const second = prepareGraph(first.graph, designer, NOW, null);
  assert.equal(second.changed, false);
  assert.equal(second.graph.projects.length, 1);
});

test('archive hides a project from the active list and restore brings it back', () => {
  let graph = seedLegacyWorkspace(owner, NOW);
  const created = createProject(graph, owner, graph.accounts[0]!.id, 'Campaign', NOW);
  graph = created.graph;
  graph = updateProject(graph, owner, created.project.slug, { status: 'archived' }, NOW);
  const active = toOverview(graph, owner).projects.filter((project) => project.status === 'active');
  assert.equal(active.some((project) => project.slug === created.project.slug), false);
  graph = updateProject(graph, owner, created.project.slug, { name: 'Campaign 2026', status: 'active' }, NOW);
  const restored = toOverview(graph, owner).projects.find((project) => project.slug === created.project.slug);
  assert.equal(restored?.name, 'Campaign 2026');
  assert.equal(restored?.status, 'active');
});

test('branches preview on their own URL and publish stamps production', () => {
  let graph = seedLegacyWorkspace(owner, NOW);
  const created = createBranch(graph, owner, 'kolbo-school', 'Homepage experiment', NOW);
  graph = created.graph;
  const view = toOverview(graph, owner).projects[0]?.branches.find((branch) => branch.slug === 'homepage-experiment');
  assert.equal(view?.kind, 'draft');
  assert.equal(view?.previewPath, '/projects/kolbo-school/preview?branch=homepage-experiment');
  assert.equal(view?.previewHost, 'homepage-experiment--kolbo-school.avibuilder.com');

  graph = promoteBranch(graph, 'kolbo-school', 'homepage-experiment', NOW);
  const branches = graph.branches.filter((branch) => branch.projectId === graph.projects[0]?.id);
  assert.equal(branches.find((branch) => branch.slug === 'homepage-experiment')?.publishedAt, NOW);
  assert.equal(branches.find((branch) => branch.kind === 'production')?.publishedAt, NOW);
  assert.equal(resolveActiveBranchSlug(null, branches), 'staging');
  assert.equal(resolveActiveBranchSlug('missing', branches), 'staging');
  assert.equal(resolveActiveBranchSlug('homepage-experiment', branches), 'homepage-experiment');
});

test('custom domains attach per project, redirect www to apex, and disconnect', () => {
  let graph = seedLegacyWorkspace(owner, NOW);
  const legacyWww = graph.domains.find((domain) => domain.hostname === 'www.kolboschool.com');
  assert.equal(legacyWww?.redirect, 'www-to-apex');
  assert.equal(redirectLocation('www.kolboschool.com', routableDomains(graph)), 'https://kolboschool.com');

  graph = attachDomain(graph, owner, 'kolbo-school', 'example.com', 'none', NOW).graph;
  const attached = attachDomain(graph, owner, 'kolbo-school', 'https://www.example.com/docs', undefined, NOW);
  graph = attached.graph;
  assert.equal(attached.domain.hostname, 'www.example.com');
  assert.equal(attached.domain.status, 'pending');
  assert.equal(attached.domain.sslStatus, 'pending');
  assert.equal(attached.domain.redirect, 'www-to-apex');
  assert.ok(toOverview(graph, owner).projects[0]?.domains.some((domain) => domain.hostname === 'www.example.com'));

  graph = updateDomainRedirect(graph, owner, 'kolbo-school', 'example.com', 'apex-to-www');
  const example = graph.domains.find((domain) => domain.hostname === 'www.example.com');
  assert.equal(example?.redirect, 'none');
  assert.equal(
    graph.domains.find((domain) => domain.hostname === 'www.kolboschool.com')?.redirect,
    'www-to-apex',
  );
  graph = disconnectDomain(graph, owner, 'kolbo-school', 'www.example.com', NOW);
  assert.equal(
    toOverview(graph, owner).projects[0]?.domains.some((domain) => domain.hostname === 'www.example.com'),
    false,
  );
  assert.throws(
    () => attachDomain(graph, owner, 'kolbo-school', 'avibuilder.com', 'none', NOW),
    /builder host/,
  );
});

test('invites stay on the project account and metadata projects do not open the shared canvas', () => {
  let graph = seedLegacyWorkspace(owner, NOW);
  const invited = inviteProjectMember(graph, owner, 'kolbo-school', 'Guest@Example.com', 'viewer', NOW);
  graph = invited.graph;
  assert.equal(invited.member.status, 'invited');
  assert.equal(canAccessProject(graph, { userId: 'guest', email: 'guest@example.com', appRole: 'editor' }, 'kolbo-school'), false);

  const created = createProject(graph, owner, graph.accounts[0]!.id, 'Microsite', NOW);
  graph = created.graph;
  assert.equal(created.project.contentMode, 'metadata');
  assert.equal(usesSharedCanvas(graph, 'kolbo-school'), true);
  assert.equal(usesSharedCanvas(graph, created.project.slug), false);
  assert.equal(resolveProjectRoute(graph, owner, 'kolbo-school'), 'editor');
  assert.equal(resolveProjectRoute(graph, owner, created.project.slug), 'space');
  graph = adoptExistingUsers(graph, [{ id: owner.userId, email: owner.email }], NOW);
  assert.equal(resolveProjectRoute(graph, designer, 'kolbo-school'), 'denied');
  assert.equal(resolveProjectRoute(null, null, 'kolbo-school'), 'editor');
  assert.equal(isProjectContentApi('/editor/api/pages'), true);
  assert.equal(isProjectContentApi('/editor/api/publish'), true);
  assert.equal(isProjectContentApi('/editor/api/supabase/config'), false);
  assert.equal(isProjectContentApi('/editor/api/domains'), false);
  assert.equal(isProjectContentApi('/editor/api/workspace/projects'), false);
});
