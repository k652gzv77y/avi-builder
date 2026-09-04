'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getProjectSlugFromPath } from '@/lib/settings-nav-items';
import { getCurrentProjectSlug } from '@/lib/project-url';

interface CollectionRow {
  id?: string;
  name?: string;
}

function collectionUrls(slug: string) {
  const urls = ['/editor/api/collections', '/ycode/api/collections'];
  if (slug) urls.unshift(`/projects/${slug}/api/collections`);
  return urls;
}

export default function CmsSettingsPage() {
  const pathname = usePathname();
  const slug = getProjectSlugFromPath(pathname) || getCurrentProjectSlug() || '';
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [collections, setCollections] = useState<CollectionRow[] | null>(null);

  useEffect(() => {
    if (searchParams.get('supabase') === 'connected') {
      setMessage('Supabase authorized.');
    }
    if (searchParams.get('error')) {
      setMessage(`Connect failed (${searchParams.get('error')}). Try Reconnect again.`);
    }
    let cancelled = false;
    (async () => {
      for (const url of collectionUrls(slug)) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const payload = await res.json();
          const rows = Array.isArray(payload?.data) ? payload.data : [];
          if (!cancelled) {
            setCollections(rows);
            return;
          }
        } catch {
          /* try next alias */
        }
      }
      if (!cancelled) setCollections([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, slug]);

  function connectSupabase() {
    const project = slug || getCurrentProjectSlug() || 'kolbo-school';
    setBusy(true);
    window.location.assign(
      `/projects/${project}/api/supabase/oauth/start?project=${encodeURIComponent(project)}`,
    );
  }

  const live = collections && collections.length > 0;

  return (
    <div className="max-w-xl">
      <h1 className="text-lg font-medium">CMS / Supabase</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Collections load from the project database. Reconnect attaches a different Supabase project via OAuth.
      </p>
      <div className="mt-5 rounded-xl border px-4 py-3 text-sm">
        {collections === null ? (
          <p className="text-muted-foreground">Checking CMS…</p>
        ) : live ? (
          <>
            <p className="text-emerald-500">Connected — {collections.length} collection{collections.length === 1 ? '' : 's'} live.</p>
            <ul className="mt-3 space-y-1 text-muted-foreground">
              {collections.slice(0, 12).map((row) => (
                <li key={row.id || row.name}>{row.name || row.id}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-muted-foreground">No collections returned yet. Use Reconnect Supabase if this project has no database.</p>
        )}
      </div>
      <Button className="mt-5" variant="outline" onClick={connectSupabase} disabled={busy}>
        {busy ? 'Opening Supabase…' : 'Reconnect Supabase'}
      </Button>
      {message && <p className="mt-3 text-sm text-amber-500">{message}</p>}
    </div>
  );
}
