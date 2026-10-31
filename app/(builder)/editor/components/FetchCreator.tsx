'use client';

/**
 * Creates a Fetch: one Supabase collection field, read as a single value.
 * Loading and Error are design variants on the binding, not interactions.
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FETCH_ERROR_TEXT, FETCH_LOADING_TEXT } from '@/lib/cms-framer';
import { SIMPLE_TEXT_FIELD_TYPES } from '@/lib/collection-field-utils';
import { generateId } from '@/lib/utils';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useFetchCreatorStore } from '@/stores/useFetchCreatorStore';
import { usePagesStore } from '@/stores/usePagesStore';
import type { FetchItemSource, FetchSpec } from '@/types';

export default function FetchCreator() {
  const open = useFetchCreatorStore(state => state.open);
  const onCreated = useFetchCreatorStore(state => state.onCreated);
  const close = useFetchCreatorStore(state => state.close);
  const currentPageId = useEditorStore(state => state.currentPageId);
  const page = usePagesStore(state => state.pages.find(item => item.id === currentPageId));
  const updatePage = usePagesStore(state => state.updatePage);
  const collections = useCollectionsStore(state => state.collections);
  const fields = useCollectionsStore(state => state.fields);
  const loadFields = useCollectionsStore(state => state.loadFields);

  const [name, setName] = useState('Fetch');
  const [collectionId, setCollectionId] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [itemSource, setItemSource] = useState<FetchItemSource>('first');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('Fetch');
    setCollectionId('');
    setFieldId('');
    setItemSource(page?.is_dynamic ? 'detail' : 'first');
    setError(null);
    setSaving(false);
  }, [open, page?.is_dynamic]);

  useEffect(() => {
    if (!collectionId) return;
    if (!fields[collectionId]) {
      void loadFields(collectionId);
    }
  }, [collectionId, fields, loadFields]);

  const collectionFields = (fields[collectionId] ?? []).filter(field => (
    SIMPLE_TEXT_FIELD_TYPES.includes(field.type)
  ));

  const handleSave = async () => {
    if (!page || !currentPageId) {
      setError('Open a page before creating a Fetch.');
      return;
    }
    const field = collectionFields.find(item => item.id === fieldId);
    if (!collectionId || !field) {
      setError('Choose a collection and a field.');
      return;
    }
    setSaving(true);
    setError(null);
    const spec: FetchSpec = {
      id: generateId('fch'),
      name: name.trim() || field.name,
      collection_id: collectionId,
      field_id: field.id,
      field_type: field.type,
      item_source: itemSource,
      preview: 'default',
      loading_text: FETCH_LOADING_TEXT,
      error_text: FETCH_ERROR_TEXT,
    };
    const result = await updatePage(currentPageId, {
      settings: {
        ...page.settings,
        fetches: [...(page.settings?.fetches ?? []), spec],
      },
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error || 'Could not save this Fetch.');
      return;
    }
    onCreated?.(spec.id);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New fetch</DialogTitle>
          <DialogDescription>
            Read one field from a Supabase collection. Design Loading and Error on the layer after it is bound.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label variant="muted">Name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label variant="muted">Collection</Label>
            <Select value={collectionId || undefined} onValueChange={(value) => { setCollectionId(value); setFieldId(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {collections.map(collection => (
                  <SelectItem key={collection.id} value={collection.id}>
                    {collection.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label variant="muted">Field</Label>
            <Select
              value={fieldId || undefined}
              onValueChange={setFieldId}
              disabled={!collectionId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {collectionFields.map(field => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label variant="muted">Item</Label>
            <Select value={itemSource} onValueChange={(value) => setItemSource(value as FetchItemSource)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first">First item</SelectItem>
                <SelectItem value="detail">Detail page</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={close}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={() => { void handleSave(); }}
            disabled={saving || !fieldId}
          >
            {saving ? 'Saving…' : 'Create fetch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
