'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCurrentProjectSlug, projectsPath } from '@/lib/project-url';
import {
  readActiveBranch,
  resolveActiveBranchSlug,
  writeActiveBranch,
  type BranchView,
} from '@/lib/workspace';

interface BranchPayload {
  canEdit?: boolean;
  branches?: BranchView[];
}

export default function BranchMenu() {
  const [branches, setBranches] = useState<BranchView[]>([]);
  const [active, setActive] = useState('staging');
  const [canEdit, setCanEdit] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const slug = getCurrentProjectSlug();
    if (!slug) return;
    try {
      const response = await fetch(projectsPath(`/api/workspace/projects/${slug}/branches`), { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json() as { data?: BranchPayload };
      const next = payload.data?.branches ?? [];
      setBranches(next);
      setCanEdit(payload.data?.canEdit === true);
      setActive(resolveActiveBranchSlug(readActiveBranch(slug), next));
    } catch {
      // The editor still publishes if the branch list cannot be loaded.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeBranch = branches.find((branch) => branch.slug === active);

  async function handleCreate() {
    const slug = getCurrentProjectSlug();
    if (!slug || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(projectsPath(`/api/workspace/projects/${slug}/branches`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; data?: { projects?: { slug: string; branches: BranchView[] }[] } };
      if (!response.ok) {
        setError(payload.error || 'Could not create the branch');
        return;
      }
      const project = payload.data?.projects?.find((entry) => entry.slug === slug);
      const created = project?.branches.find((branch) => branch.name === name.trim());
      if (project) setBranches(project.branches);
      if (created) {
        writeActiveBranch(slug, created.slug);
        setActive(created.slug);
      }
      setName('');
      setDialogOpen(false);
    } catch {
      setError('Could not create the branch');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm" variant="secondary"
            aria-label="Switch branch"
          >
            {activeBranch?.name ?? 'Staging'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Branch</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={active}
            onValueChange={(value) => {
              const slug = getCurrentProjectSlug();
              if (!slug) return;
              writeActiveBranch(slug, value);
              setActive(value);
            }}
          >
            {branches.map((branch) => (
              <DropdownMenuRadioItem key={branch.id} value={branch.slug}>
                {branch.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          {activeBranch && (
            <DropdownMenuItem asChild>
              <a
                href={activeBranch.previewPath} target="_blank"
                rel="noopener noreferrer"
              >
                Open preview
              </a>
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
              New branch
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New branch</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="branch-name">Name</Label>
            <Input
              id="branch-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Homepage experiment"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="ghost" size="sm"
              onClick={() => setDialogOpen(false)}
            >Cancel</Button>
            <Button
              size="sm" onClick={() => void handleCreate()}
              disabled={saving || !name.trim()}
            >
              {saving ? 'Creating…' : 'Create branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
