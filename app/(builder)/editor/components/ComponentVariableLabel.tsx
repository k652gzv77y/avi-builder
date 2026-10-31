'use client';

/**
 * Reusable label with the shared bindings picker.
 * Shows a "+" button in component edit mode, or a plain label otherwise.
 */

import { Label } from '@/components/ui/label';
import type { IconProps } from '@/components/ui/icon';
import BindingsPicker from './BindingsPicker';
import { defaultBindingSources } from '@/lib/component-bindings';
import type { ComponentVariable } from '@/types';

export const VARIABLE_TYPE_ICONS: Record<string, IconProps['name']> = {
  text: 'text',
  rich_text: 'rich-text',
  image: 'image',
  link: 'link',
  audio: 'audio',
  video: 'video',
  icon: 'icon',
  variant: 'component',
  stack: 'layout',
};

interface ComponentVariableLabelProps {
  /** Label text (e.g. "Content", "Source", "Type") */
  label: string;
  /** Whether the user is editing a component */
  isEditingComponent: boolean;
  /** Filtered list of variables matching this type */
  variables: ComponentVariable[];
  /** Currently linked variable ID */
  linkedVariableId?: string;
  /** Called when the user selects a variable to link */
  onLinkVariable: (variableId: string) => void;
  /** Called to open the variables dialog */
  onManageVariables: () => void;
  /** Called to create a new variable of this type with current values as defaults */
  onCreateVariable?: () => void;
  /** Extra className for the outer wrapper */
  className?: string;
}

export default function ComponentVariableLabel({
  label,
  isEditingComponent,
  variables,
  linkedVariableId,
  onLinkVariable,
  onManageVariables,
  onCreateVariable,
  className,
}: ComponentVariableLabelProps) {
  if (!isEditingComponent) {
    return <Label variant="muted" className={className}>{label}</Label>;
  }

  return (
    <BindingsPicker
      label={label}
      className={className}
      linkedId={linkedVariableId}
      onManage={onManageVariables}
      sources={defaultBindingSources({
        items: variables.map(variable => ({
          id: variable.id,
          name: variable.name,
          icon: VARIABLE_TYPE_ICONS[variable.type || 'text'],
        })),
        onCreate: onCreateVariable,
        onSelect: onLinkVariable,
      })}
    />
  );
}
