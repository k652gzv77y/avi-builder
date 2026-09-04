'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getProjectSlugFromPath } from '@/lib/settings-nav-items';

const KNOWN_HOSTS: Record<string, { host: string; role: string }[]> = {
  'kolbo-school': [
    { host: 'kolbo-school.avibuilder.com', role: 'Preview' },
    { host: 'kolboschool.com', role: 'Production' },
    { host: 'www.kolboschool.com', role: 'Production' },
    { host: 'beta.kolboschool.com', role: 'Staging' },
  ],
};

export default function DomainsSettingsPage() {
  const slug = getProjectSlugFromPath(usePathname());
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hosts = KNOWN_HOSTS[slug] || [{ host: `${slug}.avibuilder.com`, role: 'Preview' }];
  const hasCustom = hosts.some((h) => !h.host.endsWith('.avibuilder.com'));

  useEffect(() => {
    if (searchParams.get('cloudflare') === 'connected') {
      setMessage('Cloudflare authorized. Pick a zone next to attach more hosts.');
    }
    if (searchParams.get('error')) {
      setMessage('Cloudflare declined or the client is still private / redirect URI mismatch.');
    }
  }, [searchParams]);

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
    <div className="max-w-xl">
      <h1 className="text-lg font-medium">Domains</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This project already has hosts. Publish still ships the live site to the production host. Connect Cloudflare only when you need Avi to create records on a zone you own.
      </p>
      <ul className="mt-5 divide-y rounded-xl border">
        {hosts.map((row) => (
          <li key={row.host} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="truncate pr-3">{row.host}</span>
            <span className="shrink-0 text-muted-foreground">{row.role}</span>
          </li>
        ))}
      </ul>
      {hasCustom && (
        <p className="mt-4 text-sm text-emerald-500">Custom domain attached. Use Publish on desktop to ship to production.</p>
      )}
      <Button className="mt-5" variant="outline" onClick={() => void connectCloudflare()} disabled={busy}>
        {busy ? 'Opening Cloudflare…' : 'Reconnect Cloudflare'}
      </Button>
      {message && <p className="mt-3 text-sm text-amber-500">{message}</p>}
    </div>
  );
}
