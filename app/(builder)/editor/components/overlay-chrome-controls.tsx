'use client';

/**
 * Type, anchor, and close rules shared by the overlay inspector and the
 * Open Overlay action. Sheet and menu use the same controls as modal and popover.
 */

import type { ReactNode } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OVERLAY_DISMISS_ROWS } from '@/lib/interactions-framer';
import { getLayerName } from '@/lib/layer-display-utils';
import {
  OVERLAY_KINDS,
  overlayIsAnchored,
  overlayKindLabel,
  placementForKind,
} from '@/lib/overlay-position';
import type { Layer, OverlayAnchor, OverlayDismiss, OverlayKind } from '@/types';

const ANCHOR_SIDES: ReadonlyArray<{ value: OverlayAnchor; label: string }> = [
  { value: 'bottom', label: 'Bottom' },
  { value: 'top', label: 'Top' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

export interface OverlayChromeValue {
  kind: OverlayKind;
  anchor: OverlayAnchor;
  anchorLayerId?: string;
  dismiss: OverlayDismiss;
}

interface OverlayChromeControlsProps {
  value: OverlayChromeValue;
  layers: Layer[];
  excludeLayerId?: string;
  onChange: (value: OverlayChromeValue) => void;
}

export default function OverlayChromeControls({
  value,
  layers,
  excludeLayerId,
  onChange,
}: OverlayChromeControlsProps) {
  const anchored = overlayIsAnchored(value.kind);
  const anchorChoices = layers.filter(layer => layer.id !== excludeLayerId && layer.id !== 'body');

  const setKind = (kind: OverlayKind) => {
    onChange({
      ...value,
      kind,
      anchorLayerId: placementForKind(kind) === 'relative' ? value.anchorLayerId : undefined,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <Field label="Type">
        <Select value={value.kind} onValueChange={(kind) => setKind(kind as OverlayKind)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OVERLAY_KINDS.map(kind => (
              <SelectItem key={kind} value={kind}>{overlayKindLabel(kind)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {anchored && (
        <>
          <Field label="Side">
            <Select
              value={value.anchor}
              onValueChange={(anchor) => onChange({ ...value, anchor: anchor as OverlayAnchor })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANCHOR_SIDES.map(side => (
                  <SelectItem key={side.value} value={side.value}>{side.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Anchor">
            <Select
              value={value.anchorLayerId || 'trigger'}
              onValueChange={(anchorLayerId) => onChange({
                ...value,
                anchorLayerId: anchorLayerId === 'trigger' ? undefined : anchorLayerId,
              })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trigger">Trigger</SelectItem>
                {anchorChoices.map(layer => (
                  <SelectItem key={layer.id} value={layer.id}>{getLayerName(layer)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </>
      )}
      <div className="flex flex-col gap-2">
        {OVERLAY_DISMISS_ROWS.map(row => (
          <label key={row.key} className="flex items-center gap-2">
            <Checkbox
              checked={value.dismiss[row.key]}
              onCheckedChange={(checked) => onChange({
                ...value,
                dismiss: { ...value.dismiss, [row.key]: checked === true },
              })}
            />
            <Label variant="muted">{row.label}</Label>
          </label>
        ))}
      </div>
      {value.kind === 'sheet' && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Sheet sits flush on the bottom edge. Height, max height, and padding come from the layer. Drag to close is not available.
        </p>
      )}
      {value.kind === 'menu' && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Menu anchors like a popover. Child layers are the items. Up and Down move between them. Typeahead is not available.
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 items-center gap-2">
      <Label variant="muted">{label}</Label>
      <div className="col-span-2">{children}</div>
    </div>
  );
}
