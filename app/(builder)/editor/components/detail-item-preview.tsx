'use client';

/**
 * Canvas chrome for a Detail page: step the preview item and show its route.
 */

import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import CollectionItemSelector from './CollectionItemSelector';
import { useDetailPreview } from '@/hooks/use-detail-preview';
import { useEditorStore } from '@/stores/useEditorStore';

interface DetailItemPreviewProps {
  collectionId: string;
}

export default function DetailItemPreview({ collectionId }: DetailItemPreviewProps) {
  const preview = useDetailPreview();
  const itemId = useEditorStore(state => state.currentPageCollectionItemId);
  const setItemId = useEditorStore(state => state.setCurrentPageCollectionItemId);

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="size-8! p-0"
        aria-label="Previous item"
        disabled={!preview.canGoPrevious}
        onClick={preview.goPrevious}
      >
        <Icon name="chevronLeft" />
      </Button>
      <CollectionItemSelector
        collectionId={collectionId}
        value={itemId}
        onValueChange={setItemId}
        autoSelect={false}
      />
      <Button
        variant="ghost"
        size="sm"
        className="size-8! p-0"
        aria-label="Next item"
        disabled={!preview.canGoNext}
        onClick={preview.goNext}
      >
        <Icon name="chevronRight" />
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="max-w-28 truncate font-mono text-[11px] text-muted-foreground">
            {preview.route}
          </span>
        </TooltipTrigger>
        <TooltipContent>Detail page route</TooltipContent>
      </Tooltip>
    </div>
  );
}
