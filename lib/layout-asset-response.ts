import { isCloudflareRuntime } from '@/lib/platform/runtime';

/**
 * Read a public layout file.
 *
 * `fetchAsset` is the Cloudflare ASSETS binding in production. A Next rewrite
 * cannot reach that binding: the rewritten path is handled by the Next server,
 * which 404s because the file is not a route.
 */
export interface LayoutAssetFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

const CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
};

function contentTypeFor(assetPath: string): string {
  const extension = assetPath.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}

export async function responseFromLayoutAsset(
  request: Request,
  assetPath: string,
  fetcher: LayoutAssetFetcher,
): Promise<Response> {
  const assetUrl = new URL(assetPath, request.url);
  const response = await fetcher.fetch(new Request(assetUrl, {
    method: request.method,
    headers: request.headers,
  }));

  if (!response.ok) {
    await response.body?.cancel();
    return new Response('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const headers = new Headers(response.headers);
  if (!headers.get('content-type')) {
    headers.set('content-type', contentTypeFor(assetPath));
  }

  return new Response(request.method === 'HEAD' ? null : response.body, {
    status: response.status,
    headers,
  });
}

/** ASSETS binding on the Worker. Null in local Node, where public files are served by Next. */
export async function cloudflareLayoutAssetFetcher(): Promise<LayoutAssetFetcher | null> {
  if (!isCloudflareRuntime()) return null;

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const assets = getCloudflareContext().env.ASSETS;
    if (!assets) return null;
    return assets;
  } catch (error) {
    console.error('[layout asset] ASSETS binding is unavailable:', error);
    return null;
  }
}
