'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type Domain = { hostname: string; status: string; is_primary: boolean };

export default function ProjectDomainsPage() {
  const { id } = useParams<{ id: string }>();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [slug, setSlug] = useState('project');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/ycode/api/projects')
      .then((r) => r.json())
      .then((data) => {
        const project = (data.projects || []).find((p: { id: string }) => p.id === id);
        if (!project) return;
        setDomains(project.domains || []);
        setSlug(project.slug || 'project');
      })
      .catch(() => undefined);
  }, [id]);

  async function connectCloudflare() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/ycode/api/domains/cloudflare/start?projectId=${id}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setMessage(data.error || data.hint || 'Cloudflare OAuth is not configured yet.');
    } catch {
      setMessage('Could not start Cloudflare connect.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-6 py-10 text-neutral-900 dark:bg-[#111113] dark:text-white">
      <div className="mx-auto max-w-xl">
        <Link href={`/projects/${id}`} className="text-[12px] text-neutral-500">
          ← Canvas
        </Link>
        <h1 className="mt-3 text-2xl font-medium">Domains</h1>
        <p className="mt-2 text-[13px] text-neutral-500 dark:text-white/50">
          Every project starts on a preview host. Connect Cloudflare with one button so Avi can write DNS for production, staging, and branch subdomains on <em>your</em> account — the same flow if you were not the person who built Avi.
        </p>

        <section className="mt-6 rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#161618]">
          <p className="text-[11px] uppercase tracking-wider text-neutral-400">Preview</p>
          <p className="mt-1 text-[14px]">{slug}.avibuilder.com</p>
          <p className="mt-1 text-[12px] text-neutral-500">Staging: {slug}-staging.avibuilder.com</p>
        </section>

        <section className="mt-4 rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#161618]">
          <p className="text-[11px] uppercase tracking-wider text-neutral-400">Attached</p>
          <ul className="mt-2 space-y-1 text-[13px]">
            {domains.length === 0 && <li className="text-neutral-400">None yet</li>}
            {domains.map((domain) => (
              <li key={domain.hostname} className="flex justify-between">
                <span>{domain.hostname}</span>
                <span className="text-neutral-400">{domain.status}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={connectCloudflare}
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-[#0099ff] py-2 text-[13px] font-medium text-white disabled:opacity-60"
          >
            {busy ? 'Opening Cloudflare…' : 'Connect Cloudflare'}
          </button>
          {message && <p className="mt-3 text-[12px] text-amber-500">{message}</p>}
        </section>
      </div>
    </div>
  );
}
