'use client';

import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { CUSTOM_DOMAIN_CNAME_TARGET, type DomainRedirect } from '@/lib/domain-routing';
import { projectsPath } from '@/lib/project-url';
import type { DomainView } from '@/lib/workspace';

interface DomainManagerProps {
  slug: string;
  canEdit?: boolean;
}

const REDIRECT_LABELS: Record<DomainRedirect, string> = {
  none: 'No redirect',
  'www-to-apex': 'Redirect www to apex',
  'apex-to-www': 'Redirect apex to www',
};

export default function DomainManager({ slug, canEdit = true }: DomainManagerProps) {
  const [domains, setDomains] = useState<DomainView[]>([]);
  const [hostname, setHostname] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyHost, setBusyHost] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(projectsPath(`/api/domains?project=${encodeURIComponent(slug)}`), { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { data?: DomainView[]; error?: string };
      if (!response.ok) {
        setError(payload.error || 'Could not load domains');
        return;
      }
      setDomains(payload.data ?? []);
    } catch {
      setError('Could not load domains');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    void load();
  }, [load, slug]);

  async function handleAttach() {
    setBusyHost('new');
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(projectsPath(`/api/domains?project=${encodeURIComponent(slug)}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname }),
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        cloudflare?: { attempted: boolean; ok: boolean; missing: string[]; detail: string };
      };
      if (!response.ok) {
        setError(payload.error || 'Could not attach that domain');
        return;
      }
      if (payload.cloudflare && !payload.cloudflare.ok) {
        setNotice(payload.cloudflare.detail);
      }
      setHostname('');
      await load();
    } catch {
      setError('Could not attach that domain');
    } finally {
      setBusyHost(null);
    }
  }

  async function handleRedirect(host: string, redirect: DomainRedirect) {
    setBusyHost(host);
    setError(null);
    try {
      const response = await fetch(projectsPath(`/api/domains?project=${encodeURIComponent(slug)}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: host, redirect }),
      });
      const payload = await response.json().catch(() => ({})) as { data?: DomainView[]; error?: string };
      if (!response.ok) {
        setError(payload.error || 'Could not update the redirect');
        return;
      }
      setDomains(payload.data ?? []);
    } catch {
      setError('Could not update the redirect');
    } finally {
      setBusyHost(null);
    }
  }

  async function handleDisconnect(host: string) {
    setBusyHost(host);
    setError(null);
    try {
      const response = await fetch(
        projectsPath(`/api/domains?project=${encodeURIComponent(slug)}&hostname=${encodeURIComponent(host)}`),
        { method: 'DELETE' },
      );
      const payload = await response.json().catch(() => ({})) as { data?: DomainView[]; error?: string };
      if (!response.ok) {
        setError(payload.error || 'Could not disconnect the domain');
        return;
      }
      setDomains(payload.data ?? []);
    } catch {
      setError('Could not disconnect the domain');
    } finally {
      setBusyHost(null);
    }
  }

  async function handleProbe(host: string) {
    setBusyHost(host);
    setError(null);
    try {
      const response = await fetch(
        projectsPath(`/api/domains/status?project=${encodeURIComponent(slug)}&hostname=${encodeURIComponent(host)}`),
        { cache: 'no-store' },
      );
      const payload = await response.json().catch(() => ({})) as { error?: string; data?: { detail?: string } };
      if (!response.ok) {
        setError(payload.error || 'Could not check the domain');
        return;
      }
      setNotice(payload.data?.detail || 'Checked');
      await load();
    } catch {
      setError('Could not check the domain');
    } finally {
      setBusyHost(null);
    }
  }

  if (!slug) return null;
  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Point DNS at {CUSTOM_DOMAIN_CNAME_TARGET}. SSL turns green after HTTPS answers.
        The worker still needs a Cloudflare token and zone before it can create the hostname for you.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && <p className="text-sm text-amber-500">{notice}</p>}
      <ul className="divide-y rounded-xl border">
        {domains.map((domain) => {
          const live = domain.status === 'live' && domain.sslStatus === 'active';
          return (
            <li key={domain.id} className="flex flex-col gap-3 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{domain.hostname}</span>
                <Badge variant={live ? 'green' : 'secondary'}>
                  {live ? 'Live' : domain.sslStatus === 'error' ? 'SSL error' : 'Pending'}
                </Badge>
              </div>
              {domain.managed === 'custom' && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    value={domain.redirect}
                    onValueChange={(value) => void handleRedirect(domain.hostname, value as DomainRedirect)}
                    disabled={!canEdit || busyHost === domain.hostname}
                  >
                    <SelectTrigger className="w-full sm:w-56" aria-label={`Redirect for ${domain.hostname}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(REDIRECT_LABELS) as DomainRedirect[]).map((redirect) => (
                        <SelectItem key={redirect} value={redirect}>{REDIRECT_LABELS[redirect]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleProbe(domain.hostname)}
                    disabled={busyHost === domain.hostname}
                  >
                    Check DNS
                  </Button>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleDisconnect(domain.hostname)}
                      disabled={busyHost === domain.hostname}
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              )}
              {domain.checklist.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {domain.checklist.map((record) => (
                    <li key={`${record.type}-${record.host}`}>
                      {record.type} {record.host} → {record.value}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {canEdit && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void handleAttach();
          }}
        >
          <Label htmlFor="domain-host" className="sr-only">Hostname</Label>
          <Input
            id="domain-host"
            value={hostname}
            onChange={(event) => setHostname(event.target.value)}
            placeholder="www.example.com"
          />
          <Button type="submit" disabled={busyHost === 'new' || !hostname.trim()}>
            {busyHost === 'new' ? 'Attaching…' : 'Attach domain'}
          </Button>
        </form>
      )}
    </div>
  );
}
