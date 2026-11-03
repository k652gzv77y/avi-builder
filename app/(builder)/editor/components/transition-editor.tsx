'use client';

/**
 * Duration, delay, easing, spring, and stagger for one Set Variant or overlay action.
 * Instant removes the stored transition so existing projects stay immediate.
 */

import type { ReactNode } from 'react';

import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DEFAULT_BEZIER,
  TRANSITION_CURVES,
  normalizeTransition,
  readBezierComponent,
  readSeconds,
  springTransition,
  tweenTransition,
} from '@/lib/action-transition';
import type { ActionTransition, TransitionCurve, TransitionKind } from '@/types';

const KINDS: ReadonlyArray<{ value: TransitionKind; label: string }> = [
  { value: 'instant', label: 'Instant' },
  { value: 'tween', label: 'Tween' },
  { value: 'spring', label: 'Spring' },
];

interface TransitionEditorProps {
  value: ActionTransition | undefined;
  hint: string;
  onChange: (transition: ActionTransition | undefined) => void;
}

export default function TransitionEditor({ value, hint, onChange }: TransitionEditorProps) {
  const kind = value?.kind === 'tween' || value?.kind === 'spring' ? value.kind : 'instant';
  const draft = value ?? (kind === 'spring' ? springTransition() : tweenTransition());

  const handleKind = (next: TransitionKind) => {
    if (next === 'instant') {
      onChange(undefined);
      return;
    }
    const base = value ?? (next === 'spring' ? springTransition() : tweenTransition());
    onChange(normalizeTransition(base, next));
  };

  const update = (patch: Partial<ActionTransition>) => {
    onChange(normalizeTransition({ ...draft, ...patch }, kind === 'instant' ? 'tween' : kind));
  };

  return (
    <>
      <Field label="Transition">
        <Select
          value={kind}
          onValueChange={(next) => handleKind(next as TransitionKind)}
        >
          <SelectTrigger
            className="w-full"
            aria-label="Transition"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map(item => (
              <SelectItem
                key={item.value}
                value={item.value}
              >
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {kind === 'tween' && (
        <>
          <SecondsField
            label="Duration"
            ariaLabel="Duration"
            value={draft.duration}
            max={10}
            onChange={(duration) => update({ duration })}
          />
          <Field label="Easing">
            <Select
              value={draft.curve}
              onValueChange={(curve) => update({ curve: curve as TransitionCurve })}
            >
              <SelectTrigger
                className="w-full"
                aria-label="Easing"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSITION_CURVES.map(item => (
                  <SelectItem
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {draft.curve === 'cubic-bezier' && (
            <BezierFields
              value={draft.bezier}
              onChange={(bezier) => update({ bezier })}
            />
          )}
        </>
      )}
      {kind === 'spring' && (
        <>
          <NumberField
            label="Stiffness"
            ariaLabel="Spring stiffness"
            value={draft.spring.stiffness}
            min={1}
            max={10000}
            step={1}
            onChange={(stiffness) => update({ spring: { ...draft.spring, stiffness } })}
          />
          <NumberField
            label="Damping"
            ariaLabel="Spring damping"
            value={draft.spring.damping}
            min={0}
            max={1000}
            step={1}
            onChange={(damping) => update({ spring: { ...draft.spring, damping } })}
          />
          <NumberField
            label="Mass"
            ariaLabel="Spring mass"
            value={draft.spring.mass}
            min={0.01}
            max={100}
            step={0.1}
            onChange={(mass) => update({ spring: { ...draft.spring, mass } })}
          />
        </>
      )}
      {kind !== 'instant' && (
        <>
          <SecondsField
            label="Delay"
            ariaLabel="Delay"
            value={draft.delay}
            max={10}
            onChange={(delay) => update({ delay })}
          />
          <SecondsField
            label="Stagger"
            ariaLabel="Stagger"
            value={draft.stagger}
            max={2}
            onChange={(stagger) => update({ stagger })}
          />
        </>
      )}
      <p className="text-xs text-muted-foreground">
        {hint}
      </p>
    </>
  );
}

function BezierFields({
  value,
  onChange,
}: {
  value: [number, number, number, number];
  onChange: (value: [number, number, number, number]) => void;
}) {
  const labels = ['x1', 'y1', 'x2', 'y2'] as const;
  const axes: Array<'x' | 'y'> = ['x', 'y', 'x', 'y'];
  return (
    <Field label="Curve">
      <div className="grid grid-cols-4 gap-1">
        {labels.map((label, index) => (
          <InputGroup key={label}>
            <InputGroupInput
              type="number"
              step={0.01}
              value={value[index] ?? DEFAULT_BEZIER[index]}
              aria-label={`Bezier ${label}`}
              onChange={(event) => {
                const next = readBezierComponent(event.target.value, axes[index] ?? 'x');
                if (next === null) return;
                const bezier: [number, number, number, number] = [...value];
                bezier[index] = next;
                onChange(bezier);
              }}
            />
          </InputGroup>
        ))}
      </div>
    </Field>
  );
}

function SecondsField({
  label,
  ariaLabel,
  value,
  max,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <InputGroup>
        <InputGroupInput
          type="number"
          min={0}
          max={max}
          step={0.05}
          value={value}
          aria-label={ariaLabel}
          onChange={(event) => {
            const next = readSeconds(event.target.value, max);
            if (next === null) return;
            onChange(next);
          }}
        />
        <InputGroupAddon
          align="inline-end"
          className="text-xs text-muted-foreground"
        >
          s
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}

function NumberField({
  label,
  ariaLabel,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <InputGroup>
        <InputGroupInput
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={ariaLabel}
          onChange={(event) => {
            const next = readSeconds(event.target.value, max);
            if (next === null || next < min) return;
            onChange(next);
          }}
        />
      </InputGroup>
    </Field>
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
