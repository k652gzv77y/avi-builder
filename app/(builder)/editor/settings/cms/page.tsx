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

export default function CmsSettingsPage() {
  const pathname = usePathname();
  const slug = getProjectSlugFromPath(pathname) || getCurrentProjectSlug() || '';
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [collections, setCollections] = useState<CollectionRow[] | null>(null);

  useEffect(() => {
    if (!slug) return;
    if (searchParams.get('supabase') === 'connected') {
      setMessage('Supabase authorized.');
    }
    if (searchParams.get('error')) {
      setMessage(`Connect failed (${searchParams.get('error')}). Try Reconnect Supabase again.`);
    }
    let cancelled = false;
    fetch(`/projects/${slug}/api/collections`)
      .then((res) => res.json())
      .then((payload) => {
        if (cancelled) return;
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setCollections(rows);
      })
      .catch(() => {
        if (!cancelled) setCollections([]);
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams, slug]);

  async function connectSupabase() {
    const project = slug || getCurrentProjectSlug();
    if (!project) {
      setMessage('Open this page from a project first.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/projects/${project}/api/supabase/oauth/start?project=${encodeURIComponent(project)}`);
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setMessage(data.hint || data.error || 'Supabase OAuth is not configured.');
    } catch {
      setMessage('Could not start Supabase connect.');
    } finally {
      setBusy(false);
    }
  }

  const live = collections && collections.length > 0;

  return (
    <div className="max-w-xl">
      <h1 className="text-lg font-medium">CMS / Supabase</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Collections already load from the project database. One-click OAuth attaches a Supabase project to this Avi project.
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
          <p className="text-muted-foreground">No collections returned yet. Connect Supabase if this project has no database.</p>
        )}
      </div>
      <Button
        className="mt-5" variant="outline"
        onClick={() => void connectSupabase()} disabled={busy || !slug}
      >
        {busy ? 'Opening Supabase…' : 'Reconnect Supabase'}
      </Button>
      {message && <p className="mt-3 text-sm text-amber-500">{message}</p>}
    </div>
  );
}
