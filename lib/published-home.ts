import { fetchHomepage } from '@/lib/page-fetcher';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { PageData } from '@/lib/page-fetcher';

/**
 * Live sites must never fall through to the Avi welcome screen just because
 * the index flag or the ISR cache missed. Prefer the official homepage
 * fetch, then any published page.
 */
export async function loadPublishedHomepage(): Promise<PageData | null> {
  const official = await fetchHomepage(true);
  if (official?.page && official.pageLayers) {
    return official as PageData;
  }

  const supabase = await getSupabaseAdmin();
  if (!supabase) return official as PageData | null;

  const { data: pages } = await supabase
    .from('pages')
    .select('*')
    .eq('is_published', true)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(25);

  const home = pages?.find((page) => page.is_index) || pages?.[0];
  if (!home) return official as PageData | null;

  const { data: pageLayers } = await supabase
    .from('page_layers')
    .select('*')
    .eq('page_id', home.id)
    .eq('is_published', true)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pageLayers) return official as PageData | null;

  return {
    page: home,
    pageLayers,
    components: official?.components || [],
    generatedCss: pageLayers.generated_css || official?.generatedCss || null,
  } as PageData;
}
