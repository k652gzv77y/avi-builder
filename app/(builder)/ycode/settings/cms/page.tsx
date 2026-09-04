'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getProjectSlugFromPath } from '@/lib/settings-nav-items';

export default function CmsSettingsPage() {
  const slug = getProjectSlugFromPath(usePathname());
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (searchParams.get('supabase') === 'connected') {
      setConnected(true);
      window.localStorage.setItem(`avi:sb:${slug}`, 'connected');
    }
    if (window.localStorage.getItem(`avi:sb:${slug}`) === 'connected') {
      setConnected(true);
    }
  }, [searchParams, slug]);

  async function connectSupabase() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/projects/${slug}/api/supabase/oauth/start?project=${encodeURIComponent(slug)}`);
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

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <h1 className="text-lg font-medium">CMS / Supabase</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        One-click connect uses your Supabase login. After consent you pick which Supabase project feeds this Avi project’s CMS.
      </p>
      {connected ? (
        <p className="mt-5 text-sm text-emerald-500">Supabase account connected. Project picker is next — Avi will list your Supabase projects so you can attach one.</p>
      ) : (
        <Button className="mt-5" onClick={() => void connectSupabase()} disabled={busy}>
          {busy ? 'Opening Supabase…' : 'Connect Supabase'}
        </Button>
      )}
      {message && <p className="mt-3 text-sm text-amber-500">{message}</p>}
    </div>
  );
}
