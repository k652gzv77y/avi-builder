'use client';

/**
 * Reusable label with the shared bindings picker.
 * Shows a "+" button in component edit mode, or a plain label otherwise.
 */

import { Label } from '@/components/ui/label';
import type { IconProps } from '@/components/ui/icon';
import BindingsPicker from './BindingsPicker';
import ProjectVariablePicker from './ProjectVariablePicker';
import { defaultBindingSources, type BindingSourceItem } from '@/lib/component-bindings';
import type { ProjectVariableOption } from '@/lib/project-variable-picker';
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
  number: 'hash',
  boolean: 'checkbox',
  enum: 'listUnordered',
  color: 'color',
  array: 'listOrdered',
  object: 'box',
  slot: 'layers',
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
  /** Collection fields from a Collection List or Detail Page. */
  cmsItems?: BindingSourceItem[];
  onSelectCms?: (id: string) => void;
  /** Single-value Fetch bindings. */
  fetchItems?: BindingSourceItem[];
  onSelectFetch?: (id: string) => void;
  onCreateFetch?: () => void;
  /** Name shown on the trigger when CMS or Fetch is linked. */
  linkedName?: string;
  onUnlink?: () => void;
  /** Use the shared project-variable picker for this property. */
  projectProperty?: 'text';
  allowRichText?: boolean;
  projectBoundId?: string;
  projectBoundName?: string;
  onSelectProject?: (option: ProjectVariableOption) => void;
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
  cmsItems,
  onSelectCms,
  fetchItems,
  onSelectFetch,
  onCreateFetch,
  linkedName,
  onUnlink,
  projectProperty,
  allowRichText,
  projectBoundId,
  projectBoundName,
  onSelectProject,
  className,
}: ComponentVariableLabelProps) {
  const sources = defaultBindingSources({
    enabled: isEditingComponent,
    items: variables.map(variable => ({
      id: variable.id,
      name: variable.name,
      icon: VARIABLE_TYPE_ICONS[variable.type || 'text'],
    })),
    onCreate: isEditingComponent ? onCreateVariable : undefined,
    onSelect: isEditingComponent ? onLinkVariable : undefined,
  }, {
    cms: { items: cmsItems, onSelect: onSelectCms },
    fetch: { items: fetchItems, onSelect: onSelectFetch, onCreate: onCreateFetch },
  });

  if (projectProperty) {
    return (
      <ProjectVariablePicker
        label={label}
        property={projectProperty}
        className={className}
        boundId={projectBoundId}
        boundName={projectBoundName}
        linkedSourceId={linkedVariableId}
        linkedSourceName={linkedName}
        onUnlink={onUnlink}
        onUnbind={onUnlink}
        onManage={isEditingComponent ? onManageVariables : undefined}
        onSelect={onSelectProject ?? (() => undefined)}
        allowRichText={allowRichText}
        sources={sources.filter(source => source.id !== 'globals')}
      />
    );
  }

  const offersBindings = isEditingComponent || !!onSelectCms || !!onSelectFetch || !!onCreateFetch;
  if (!offersBindings) {
    return <Label variant="muted" className={className}>{label}</Label>;
  }

  return (
    <BindingsPicker
      label={label}
      className={className}
      linkedId={linkedVariableId}
      linkedName={linkedName}
      onUnlink={onUnlink}
      onManage={isEditingComponent ? onManageVariables : undefined}
      sources={sources}
    />
  );
}
