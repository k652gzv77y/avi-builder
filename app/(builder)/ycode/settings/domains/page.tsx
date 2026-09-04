'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function DomainsSettingsPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connectCloudflare() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/projects/kolbo-school/api/domains/cloudflare/start');
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setMessage(data.hint || data.error || 'Add CLOUDFLARE_OAUTH_CLIENT_ID on the Worker to finish this button.');
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
        This project publishes on its attached hosts. Preview stays on avibuilder.com until you connect a zone you control.
      </p>
      <div className="mt-6 space-y-3 rounded-xl border bg-card p-5 text-sm">
        <div className="flex items-center justify-between">
          <span>kolbo-school.avibuilder.com</span>
          <span className="text-muted-foreground">Preview</span>
        </div>
        <div className="flex items-center justify-between">
          <span>kolboschool.com</span>
          <span className="text-muted-foreground">Production</span>
        </div>
        <div className="flex items-center justify-between">
          <span>beta.kolboschool.com</span>
          <span className="text-muted-foreground">Staging</span>
        </div>
      </div>
      <Button className="mt-5" onClick={() => void connectCloudflare()} disabled={busy}>
        {busy ? 'Opening Cloudflare…' : 'Connect Cloudflare'}
      </Button>
      {message && <p className="mt-3 text-sm text-amber-500">{message}</p>}
    </div>
  );
}
