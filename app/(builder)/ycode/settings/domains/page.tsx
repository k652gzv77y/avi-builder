'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getProjectSlugFromPath } from '@/lib/settings-nav-items';

export default function DomainsSettingsPage() {
  const slug = getProjectSlugFromPath(usePathname());
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (searchParams.get('cloudflare') === 'connected') {
      setConnected(true);
      window.localStorage.setItem(`avi:cf:${slug}`, 'connected');
    }
    if (window.localStorage.getItem(`avi:cf:${slug}`) === 'connected') {
      setConnected(true);
    }
  }, [searchParams, slug]);

  async function connectCloudflare() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/projects/${slug}/api/domains/cloudflare/start?project=${encodeURIComponent(slug)}`);
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setMessage(data.hint || data.error || 'Cloudflare OAuth is not configured.');
    } catch {
      setMessage('Could not start Cloudflare connect.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <h1 className="text-lg font-medium">Domains</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Preview is {slug}.avibuilder.com until you attach a zone you control.
      </p>
      {connected ? (
        <p className="mt-5 text-sm text-emerald-500">Cloudflare account connected. Zone picker is next — Avi will list your zones so you can attach one to this project.</p>
      ) : (
        <Button className="mt-5" onClick={() => void connectCloudflare()} disabled={busy}>
          {busy ? 'Opening Cloudflare…' : 'Connect Cloudflare'}
        </Button>
      )}
      {message && <p className="mt-3 text-sm text-amber-500">{message}</p>}
    </div>
  );
}
