'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEditorUrl } from '@/hooks/use-editor-url';
import { useRole } from '@/hooks/use-role';
import { findHomepage } from '@/lib/page-utils';
import { projectsPath } from '@/lib/project-url';
import { cn } from '@/lib/utils';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';

import type { IconProps } from '@/components/ui/icon';

type RailTool = 'insert' | 'layers' | 'pages' | 'assets' | 'cms' | 'forms';

interface RailItem {
  id: RailTool;
  icon: IconProps['name'];
  label: string;
  shortcut?: string;
}

const DESIGNER_TOOLS: RailItem[] = [
  { id: 'insert', icon: 'plus', label: 'Insert', shortcut: 'I' },
  { id: 'layers', icon: 'layers', label: 'Layers' },
  { id: 'pages', icon: 'page', label: 'Pages' },
  { id: 'assets', icon: 'image', label: 'Assets' },
  { id: 'cms', icon: 'database', label: 'CMS' },
  { id: 'forms', icon: 'form', label: 'Forms' },
];

const EDITOR_TOOLS: RailItem[] = [
  { id: 'layers', icon: 'pencil', label: 'Content' },
  { id: 'pages', icon: 'page', label: 'Pages' },
  { id: 'cms', icon: 'database', label: 'CMS' },
];

export default function BuilderToolRail() {
  const router = useRouter();
  const { isEditor } = useRole();
  const { routeType, navigateToLayers, navigateToCollection, navigateToCollections } = useEditorUrl();

  const activeSidebarTab = useEditorStore((state) => state.activeSidebarTab);
  const setActiveSidebarTab = useEditorStore((state) => state.setActiveSidebarTab);
  const lastDesignUrl = useEditorStore((state) => state.lastDesignUrl);
  const setLastDesignUrl = useEditorStore((state) => state.setLastDesignUrl);
  const currentPageId = useEditorStore((state) => state.currentPageId);
  const openFileManager = useEditorStore((state) => state.openFileManager);

  const pages = usePagesStore((state) => state.pages);
  const collections = useCollectionsStore((state) => state.collections);
  const selectedCollectionId = useCollectionsStore((state) => state.selectedCollectionId);
  const setSelectedCollectionId = useCollectionsStore((state) => state.setSelectedCollectionId);

  const [isInsertOpen, setIsInsertOpen] = useState(false);

  useEffect(() => {
    const handleToggle = (event: Event) => {
      const tab = (event as CustomEvent<{ tab?: string }>).detail?.tab;
      setIsInsertOpen((prev) => (tab ? true : !prev));
    };
    const handleClose = () => setIsInsertOpen(false);

    window.addEventListener('toggleElementLibrary', handleToggle);
    window.addEventListener('closeElementLibrary', handleClose);

    return () => {
      window.removeEventListener('toggleElementLibrary', handleToggle);
      window.removeEventListener('closeElementLibrary', handleClose);
    };
  }, []);

  const tools = isEditor ? EDITOR_TOOLS : DESIGNER_TOOLS;

  const activeTool = useMemo<RailTool>(() => {
    if (isInsertOpen) return 'insert';
    if (routeType === 'collection' || routeType === 'collections-base' || activeSidebarTab === 'cms') {
      return 'cms';
    }
    if (routeType === 'forms') return 'forms';
    if (activeSidebarTab === 'pages') return 'pages';
    return 'layers';
  }, [activeSidebarTab, isInsertOpen, routeType]);

  const rememberDesignUrl = useCallback(() => {
    const isDesignRoute = routeType === 'layers' || routeType === 'page' || routeType === 'component' || routeType === null;
    if (isDesignRoute) {
      setLastDesignUrl(window.location.pathname + window.location.search);
    }
  }, [routeType, setLastDesignUrl]);

  const goToDesign = useCallback((tab: 'layers' | 'pages') => {
    setActiveSidebarTab(tab);
    if (lastDesignUrl && tab === 'layers') {
      router.push(lastDesignUrl);
      return;
    }
    const targetPageId = currentPageId || findHomepage(pages)?.id || pages[0]?.id;
    if (targetPageId) {
      navigateToLayers(targetPageId);
    }
  }, [currentPageId, lastDesignUrl, navigateToLayers, pages, router, setActiveSidebarTab]);

  const handleSelect = useCallback((tool: RailTool) => {
    if (tool === 'insert') {
      if (activeSidebarTab !== 'layers') {
        setActiveSidebarTab('layers');
        const targetPageId = currentPageId || findHomepage(pages)?.id || pages[0]?.id;
        if (targetPageId && routeType !== 'layers' && routeType !== 'page' && routeType !== 'component' && routeType !== null) {
          navigateToLayers(targetPageId);
        }
      }
      if (isInsertOpen) {
        window.dispatchEvent(new Event('closeElementLibrary'));
      } else {
        window.dispatchEvent(new CustomEvent('toggleElementLibrary', {
          detail: { tab: 'elements' },
        }));
      }
      return;
    }

    if (isInsertOpen) {
      window.dispatchEvent(new Event('closeElementLibrary'));
    }

    if (tool === 'layers') {
      goToDesign('layers');
      return;
    }

    if (tool === 'pages') {
      goToDesign('pages');
      return;
    }

    if (tool === 'assets') {
      openFileManager();
      return;
    }

    if (tool === 'cms') {
      rememberDesignUrl();
      setActiveSidebarTab('cms');
      const targetCollectionId = selectedCollectionId || collections[0]?.id;
      if (targetCollectionId) {
        setSelectedCollectionId(targetCollectionId);
        navigateToCollection(targetCollectionId);
      } else {
        navigateToCollections();
      }
      return;
    }

    if (tool === 'forms') {
      rememberDesignUrl();
      router.push(projectsPath('/forms'));
    }
  }, [
    activeSidebarTab,
    collections,
    currentPageId,
    goToDesign,
    isInsertOpen,
    navigateToCollection,
    navigateToCollections,
    navigateToLayers,
    openFileManager,
    pages,
    rememberDesignUrl,
    routeType,
    router,
    selectedCollectionId,
    setActiveSidebarTab,
    setSelectedCollectionId,
  ]);

  return (
    <nav
      aria-label="Builder tools"
      className="flex h-full w-11 shrink-0 flex-col items-center gap-0.5 border-r border-border bg-background py-1.5"
    >
      {tools.map((tool) => {
        const isActive = activeTool === tool.id;

        return (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={tool.label}
                aria-pressed={isActive}
                onClick={() => handleSelect(tool.id)}
                className={cn(
                  'size-8 rounded-lg text-muted-foreground',
                  isActive && 'bg-secondary text-foreground',
                )}
              >
                <Icon name={tool.icon} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={6}>
              <span>{tool.label}</span>
              {tool.shortcut ? (
                <span className="ml-2 text-muted-foreground">{tool.shortcut}</span>
              ) : null}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
