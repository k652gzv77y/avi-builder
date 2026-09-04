import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function getWorkerVar(name: string): Promise<string | undefined> {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const value = (env as Record<string, unknown> | undefined)?.[name];
    return typeof value === 'string' && value ? value : undefined;
  } catch {
    return undefined;
  }
}
