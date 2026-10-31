import { getAppSettingValue, setAppSetting } from '@/lib/repositories/appSettingsRepository';
import {
  emptyGraph,
  WORKSPACE_APP_ID,
  WORKSPACE_GRAPH_KEY,
  type WorkspaceGraph,
} from '@/lib/workspace';

const CACHE_MS = 15_000;

let cache: { at: number; graph: WorkspaceGraph } | null = null;

function isGraph(value: unknown): value is WorkspaceGraph {
  if (!value || typeof value !== 'object') return false;
  const graph = value as Partial<WorkspaceGraph>;
  return Array.isArray(graph.accounts)
    && Array.isArray(graph.members)
    && Array.isArray(graph.projects)
    && Array.isArray(graph.branches)
    && Array.isArray(graph.domains);
}

export async function readWorkspaceGraph(): Promise<WorkspaceGraph> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.graph;

  const value = await getAppSettingValue<unknown>(WORKSPACE_APP_ID, WORKSPACE_GRAPH_KEY);
  const stored = isGraph(value) ? value : emptyGraph();
  const graph = typeof stored.legacyAdopted === 'boolean'
    ? stored
    : { ...stored, legacyAdopted: false };
  cache = { at: Date.now(), graph };
  return graph;
}

export async function writeWorkspaceGraph(graph: WorkspaceGraph): Promise<void> {
  await setAppSetting(WORKSPACE_APP_ID, WORKSPACE_GRAPH_KEY, graph);
  cache = { at: Date.now(), graph };
}
