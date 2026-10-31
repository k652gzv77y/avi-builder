'use client';

/**
 * + menu for binding a property. Variables, CMS, and Fetch share this menu.
 * A source stays disabled until it has items or a create action.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { BindingSource } from '@/lib/component-bindings';
import type { IconProps } from '@/components/ui/icon';

interface BindingsPickerProps {
  label: string;
  /** When set, the trigger shows the linked variable instead of the property name. */
  linkedName?: string;
  linkedId?: string;
  sources: BindingSource[];
  onUnlink?: () => void;
  onManage?: () => void;
  className?: string;
}

export default function BindingsPicker({
  label,
  linkedName,
  linkedId,
  sources,
  onUnlink,
  onManage,
  className,
}: BindingsPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={linkedName ? 'purple' : 'variable'}
          size="xs"
          className={className ?? 'has-[>svg]:px-0'}
        >
          <Icon name={linkedName ? 'link' : 'plus-circle-solid'} />
          {linkedName ?? label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {sources.filter(source => source.enabled && source.kind === 'variable').map(source => {
          const items = source.items ?? [];
          return (
            <React.Fragment key={source.kind}>
              {source.onCreate && (
                <DropdownMenuItem
                  onClick={source.onCreate}
                  disabled={!!linkedId}
                >
                  Create variable
                </DropdownMenuItem>
              )}
              {items.length > 0 && source.onSelect && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Link to variable</DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      {items.map(item => (
                        <DropdownMenuItem
                          key={item.id}
                          onClick={() => source.onSelect?.(item.id)}
                        >
                          {item.icon && (
                            <Icon
                              name={item.icon as IconProps['name']}
                              className="size-3 opacity-60"
                            />
                          )}
                          {item.name}
                          {linkedId === item.id && (
                            <Icon name="check" className="ml-auto size-3" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              )}
            </React.Fragment>
          );
        })}
        {sources.filter(source => source.enabled && source.kind !== 'variable').map(source => {
          const items = source.items ?? [];
          return (
            <DropdownMenuSub key={source.kind}>
              <DropdownMenuSubTrigger>{source.label}</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="w-56">
                  {source.onCreate && (
                    <DropdownMenuItem onClick={source.onCreate}>
                      {source.kind === 'fetch' ? 'New fetch' : 'Create'}
                    </DropdownMenuItem>
                  )}
                  {items.map(item => (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => source.onSelect?.(item.id)}
                    >
                      {item.icon && (
                        <Icon
                          name={item.icon as IconProps['name']}
                          className="size-3 opacity-60"
                        />
                      )}
                      <span className="truncate">{item.name}</span>
                      {linkedId === item.id && (
                        <Icon name="check" className="ml-auto size-3" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          );
        })}
        {sources.some(source => !source.enabled) && <DropdownMenuSeparator />}
        {sources.filter(source => !source.enabled).map(source => (
          <DropdownMenuItem
            key={source.kind}
            disabled
            title={source.unavailableReason}
          >
            {source.label}
          </DropdownMenuItem>
        ))}
        {onUnlink && linkedId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onUnlink}>
              Remove variable
            </DropdownMenuItem>
          </>
        )}
        {onManage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onManage}>
              Manage variables
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Plain label outside component editing. The + picker is for the master only. */
export function PropertyLabel({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return <Label variant="muted" className={className}>{label}</Label>;
}

/** Stack property label. Falls back to plain text when the layer is not inside a component. */
export function StackPropertyLabel({
  binding,
  fallback,
  className,
}: {
  binding: {
    label: string;
    linkedId?: string;
    linkedName?: string;
    sources: BindingSource[];
    onUnlink?: () => void;
  } | null;
  fallback: string;
  className?: string;
}) {
  if (!binding) return <PropertyLabel label={fallback} className={className} />;
  return <BindingsPicker {...binding} className={className} />;
}
