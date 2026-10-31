'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import DomainManager from '@/components/workspace/domain-manager';
import { CLOUDFLARE_DOMAIN_STEPS } from '@/lib/domain-routing';
import { getProjectSlugFromPath } from '@/lib/settings-nav-items';

export default function DomainsSettingsPage() {
  const slug = getProjectSlugFromPath(usePathname());
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (searchParams.get('cloudflare') === 'connected') {
      setMessage('Cloudflare authorized. Domain writes still use CLOUDFLARE_API_TOKEN on the worker.');
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
      <div className="mt-4">
        <DomainManager slug={slug} />
      </div>
      <ol className="mt-6 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
        {CLOUDFLARE_DOMAIN_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <Button
        className="mt-5"
        variant="outline"
        onClick={() => void connectCloudflare()}
        disabled={busy}
      >
        {busy ? 'Opening Cloudflare…' : 'Reconnect Cloudflare'}
      </Button>
      {message && <p className="mt-3 text-sm text-amber-500">{message}</p>}
    </div>
  );
}
