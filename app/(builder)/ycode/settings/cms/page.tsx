'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function CmsSettingsPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connectSupabase() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/projects/kolbo-school/api/supabase/oauth/start');
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setMessage(data.hint || data.error || 'Add SUPABASE_OAUTH_CLIENT_ID to enable one-click project pick.');
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
        Collections and variables stay in this editor. Connect a customer Supabase project for live CMS data — no pasted keys.
      </p>
      <Button className="mt-5" onClick={() => void connectSupabase()} disabled={busy}>
        {busy ? 'Opening Supabase…' : 'Connect Supabase'}
      </Button>
      {message && <p className="mt-3 text-sm text-amber-500">{message}</p>}
    </div>
  );
}
