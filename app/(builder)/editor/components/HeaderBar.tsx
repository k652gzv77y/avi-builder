'use client';

import { projectsPath } from '@/lib/project-url';

import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useEditorUrl } from '@/hooks/use-editor-url';
import { findHomepage } from '@/lib/page-utils';
import { getTranslationValue } from '@/lib/localisation-utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useLocalisationStore } from '@/stores/useLocalisationStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { buildSlugPath, buildDynamicPageUrl, buildLocalizedSlugPath, buildLocalizedDynamicPageUrl } from '@/lib/page-utils';
import type { Page } from '@/types';
import type { User } from '@supabase/supabase-js';
import ActiveUsersInHeader from './ActiveUsersInHeader';
import InviteUserButton from './InviteUserButton';
import { LocaleSelector } from './LocaleSelector';
import PublishPopover from './PublishPopover';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { BackupRestoreDialog } from '@/components/project/BackupRestoreDialog';
import { isCloudVersion } from '@/lib/utils';
import { useRole } from '@/hooks/use-role';
import AviBuilderMark from '@/components/branding/AviBuilderMark';
import { publishedOrigin } from '@/lib/platform/published-origin';

interface HeaderBarProps {
  user: User | null;
  signOut: () => Promise<void>;
  showPageDropdown: boolean;
  setShowPageDropdown: (show: boolean) => void;
  currentPage: Page | undefined;
  currentPageId: string | null;
  pages: Page[];
  setCurrentPageId: (id: string) => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  isPublishing: boolean;
  setIsPublishing: (isPublishing: boolean) => void;
  saveImmediately: (pageId: string) => Promise<void>;
  activeTab: 'pages' | 'layers' | 'cms';
  onExitComponentEditMode?: () => void;
  onPublishSuccess: () => void;
  isSettingsRoute?: boolean;
}

export default function HeaderBar({
  user,
  signOut,
  showPageDropdown,
  setShowPageDropdown,
  currentPage,
  currentPageId,
  pages,
  setCurrentPageId,
  isSaving,
  hasUnsavedChanges,
  lastSaved,
  isPublishing,
  setIsPublishing,
  saveImmediately,
  activeTab,
  onExitComponentEditMode,
  onPublishSuccess,
  isSettingsRoute = false,
}: HeaderBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pageDropdownRef = useRef<HTMLDivElement>(null);
  const { isEditor, canManageSettings, canManageMembers } = useRole();
  const editorSidebarTab = useEditorStore((s) => s.activeSidebarTab);
  const currentPageCollectionItemId = useEditorStore((s) => s.currentPageCollectionItemId);
  const storeCurrentPageId = useEditorStore((s) => s.currentPageId);
  const isPreviewMode = useEditorStore((s) => s.isPreviewMode);
  const setPreviewMode = useEditorStore((s) => s.setPreviewMode);
  const openFileManager = useEditorStore((s) => s.openFileManager);
  const setKeyboardShortcutsOpen = useEditorStore((s) => s.setKeyboardShortcutsOpen);
  const setActiveSidebarTab = useEditorStore((s) => s.setActiveSidebarTab);
  const lastDesignUrl = useEditorStore((s) => s.lastDesignUrl);
  const setLastDesignUrl = useEditorStore((s) => s.setLastDesignUrl);
  const previewReturnUrl = useEditorStore((s) => s.previewReturnUrl);
  const previewReturnTab = useEditorStore((s) => s.previewReturnTab);
  const setPreviewReturn = useEditorStore((s) => s.setPreviewReturn);
  const folders = usePagesStore((s) => s.folders);
  const storePages = usePagesStore((s) => s.pages);
  const items = useCollectionsStore((s) => s.items);
  const fields = useCollectionsStore((s) => s.fields);
  const collections = useCollectionsStore((s) => s.collections);
  const storeSelectedCollectionId = useCollectionsStore((s) => s.selectedCollectionId);
  const setSelectedCollectionId = useCollectionsStore((s) => s.setSelectedCollectionId);
  const globalCanonicalUrl = useSettingsStore((s) => s.settingsByKey.global_canonical_url as string | null | undefined);
  const locales = useLocalisationStore((s) => s.locales);
  const selectedLocaleId = useLocalisationStore((s) => s.selectedLocaleId);
  const translations = useLocalisationStore((s) => s.translations);
  const { navigateToLayers, navigateToCollection, navigateToCollections, updateQueryParams, routeType } = useEditorUrl();
  type NavButton = 'design' | 'cms' | 'forms';
  const [optimisticNav, setOptimisticNav] = useState<NavButton | null>(null);

  useEffect(() => {
    if (!optimisticNav) return;
    const isDesignRoute = routeType === 'layers' || routeType === 'page' || routeType === 'component' || routeType === null;
    const isCmsRoute = routeType === 'collection' || routeType === 'collections-base';
    const isFormsRoute = routeType === 'forms';
    if ((optimisticNav === 'design' && isDesignRoute) || (optimisticNav === 'cms' && isCmsRoute) || (optimisticNav === 'forms' && isFormsRoute)) {
      setOptimisticNav(null);
    }
  }, [routeType, optimisticNav]);

  useEffect(() => {
    if (!isPreviewMode || previewReturnUrl) return;
    const isDesignRoute = routeType === 'layers' || routeType === 'page' || routeType === 'component' || routeType === null;
    if (!isDesignRoute) setPreviewMode(false);
  }, [routeType, isPreviewMode, previewReturnUrl, setPreviewMode]);

  const activeNavButton = useMemo((): NavButton | null => {
    if (optimisticNav) return optimisticNav;
    if (routeType === 'collection' || routeType === 'collections-base') return 'cms';
    if (routeType === 'forms') return 'forms';
    if (routeType === 'layers' || routeType === 'page' || routeType === 'component' || routeType === null) return 'design';
    return null;
  }, [optimisticNav, routeType]);

  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as 'system' | 'light' | 'dark' | null;
      return savedTheme || 'dark';
    }
    return 'dark';
  });
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [hasUpdate, setHasUpdate] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);

  useEffect(() => {
    setBaseUrl(publishedOrigin(globalCanonicalUrl));
  }, [globalCanonicalUrl]);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const response = await fetch(projectsPath('/api/updates/check'));
        if (response.ok) {
          const data = await response.json();
          setHasUpdate(data.available === true);
        }
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    };
    checkForUpdates();
  }, []);

  const selectedLocale = useMemo(() => {
    if (!selectedLocaleId) return null;
    return locales.find(l => l.id === selectedLocaleId) || null;
  }, [selectedLocaleId, locales]);

  const localeTranslations = useMemo(() => {
    return selectedLocaleId ? translations[selectedLocaleId] : undefined;
  }, [selectedLocaleId, translations]);

  const localizedPagePath = useMemo(() => {
    const pageToUse = currentPage || (isSettingsRoute ? findHomepage(storePages) : null);
    if (!pageToUse) return '/';
    return buildLocalizedSlugPath(pageToUse, folders, 'page', selectedLocale, localeTranslations);
  }, [currentPage, isSettingsRoute, storePages, folders, selectedLocale, localeTranslations]);

  const collectionItemSlug = useMemo(() => {
    if (!currentPage?.is_dynamic || !currentPageCollectionItemId) return null;
    const collectionId = currentPage.settings?.cms?.collection_id;
    const slugFieldId = currentPage.settings?.cms?.slug_field_id;
    if (!collectionId || !slugFieldId) return null;
    const collectionItems = items[collectionId] || [];
    const selectedItem = collectionItems.find(item => item.id === currentPageCollectionItemId);
    if (!selectedItem || !selectedItem.values) return null;
    let slugValue = selectedItem.values[slugFieldId];
    if (localeTranslations && slugValue) {
      const collectionFields = fields[collectionId] || [];
      const slugField = collectionFields.find((f: { id: string; key: string | null }) => f.id === slugFieldId);
      if (slugField) {
        const contentKey = slugField.key ? `field:key:${slugField.key}` : `field:id:${slugField.id}`;
        const translationKey = `cms:${currentPageCollectionItemId}:${contentKey}`;
        const translatedSlug = getTranslationValue(localeTranslations[translationKey]);
        if (translatedSlug) slugValue = translatedSlug;
      }
    }
    return slugValue || null;
  }, [currentPage, currentPageCollectionItemId, items, fields, localeTranslations]);

  const publishedUrl = useMemo(() => {
    const pageToUse = currentPage || (isSettingsRoute ? findHomepage(storePages) : null);
    if (!pageToUse) return '';
    const path = pageToUse.is_dynamic
      ? buildLocalizedDynamicPageUrl(pageToUse, folders, collectionItemSlug, selectedLocale, localeTranslations)
      : localizedPagePath;
    return path === '/' ? '' : path;
  }, [currentPage, isSettingsRoute, storePages, folders, localizedPagePath, collectionItemSlug, selectedLocale, localeTranslations]);

  const handleTogglePreview = useCallback(() => {
    if (!currentPage || isSaving) return;
    if (isPreviewMode) {
      if (previewReturnUrl) {
        if (previewReturnTab) setActiveSidebarTab(previewReturnTab);
        router.push(previewReturnUrl);
        setPreviewReturn(null);
        return;
      }
      setPreviewMode(false);
      updateQueryParams({ preview: undefined });
      return;
    }
    setPreviewMode(true);
    const isDesignRoute = routeType === 'layers' || routeType === 'page' || routeType === 'component' || routeType === null;
    if (!isDesignRoute && currentPageId) {
      setPreviewReturn(window.location.pathname + window.location.search, activeTab);
      setActiveSidebarTab('layers');
      const params = new URLSearchParams(window.location.search);
      params.set('preview', 'true');
      router.push(projectsPath(`/layers/${currentPageId}?${params.toString()}`));
      return;
    }
    updateQueryParams({ preview: 'true' });
  }, [currentPage, currentPageId, isSaving, isPreviewMode, previewReturnUrl, previewReturnTab, routeType, activeTab, router, setActiveSidebarTab, setPreviewMode, setPreviewReturn, updateQueryParams]);

  useEffect(() => {
    const handleTogglePreviewEvent = () => handleTogglePreview();
    window.addEventListener('togglePreview', handleTogglePreviewEvent);
    return () => window.removeEventListener('togglePreview', handleTogglePreviewEvent);
  }, [handleTogglePreview]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemPrefersDark) root.classList.add('dark');
      else root.classList.remove('dark');
    } else if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pageDropdownRef.current && !pageDropdownRef.current.contains(event.target as Node)) {
        setShowPageDropdown(false);
      }
    };
    if (showPageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPageDropdown, setShowPageDropdown]);

  return (
    <>
    <header className="h-14 bg-background border-b grid grid-cols-3 items-center px-4">
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary" size="sm"
              className="size-8! p-0"
            >
              <AviBuilderMark className="size-5 text-secondary-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => router.push('/projects')}>
              Back to dashboard
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {canManageSettings && (
              <DropdownMenuItem onClick={() => router.push(projectsPath('/settings/general'))}>
                Settings
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => openFileManager()}>
              File manager
            </DropdownMenuItem>
            {canManageSettings && (
              <>
                <DropdownMenuItem onClick={() => router.push(projectsPath('/integrations/apps'))}>
                  Integrations
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowTransferDialog(true)}>
                  Backup &amp; Restore
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as 'system' | 'light' | 'dark')}>
                  <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={() => setKeyboardShortcutsOpen(true)}>
              Keyboard shortcuts
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push(projectsPath('/profile'))}>
              My profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={async () => { await signOut(); }}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex gap-1">
          {isEditor ? (
            <>
              <Button
                variant={(activeNavButton === 'design' && editorSidebarTab !== 'pages') ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => {
                  setOptimisticNav('design');
                  setActiveSidebarTab('layers');
                  if (lastDesignUrl) {
                    router.push(lastDesignUrl);
                  } else {
                    const targetPageId = storeCurrentPageId || findHomepage(storePages)?.id || storePages[0]?.id;
                    if (targetPageId) navigateToLayers(targetPageId);
                  }
                }}
              >
                <Icon name="pencil" />
                Content editor
              </Button>
              <Button
                variant={editorSidebarTab === 'pages' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => {
                  setActiveSidebarTab('pages');
                  const targetPageId = storeCurrentPageId || findHomepage(storePages)?.id || storePages[0]?.id;
                  if (targetPageId) navigateToLayers(targetPageId);
                }}
              >
                <Icon name="page" />
                Pages
              </Button>
            </>
          ) : (
            <Button
              variant={activeNavButton === 'design' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                setOptimisticNav('design');
                setActiveSidebarTab('layers');
                if (lastDesignUrl) {
                  router.push(lastDesignUrl);
                } else {
                  const targetPageId = storeCurrentPageId || findHomepage(storePages)?.id || storePages[0]?.id;
                  if (targetPageId) navigateToLayers(targetPageId);
                }
              }}
            >
              <Icon name="cursor-default" />
              Design
            </Button>
          )}
          <Button
            variant={activeNavButton === 'cms' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              const isDesignRoute = routeType === 'layers' || routeType === 'page' || routeType === 'component';
              if (isDesignRoute) setLastDesignUrl(window.location.pathname + window.location.search);
              setOptimisticNav('cms');
              setActiveSidebarTab('cms');
              const targetCollectionId = storeSelectedCollectionId || collections[0]?.id;
              if (targetCollectionId) {
                setSelectedCollectionId(targetCollectionId);
                navigateToCollection(targetCollectionId);
              } else {
                navigateToCollections();
              }
            }}
          >
            <Icon name="database" />
            CMS
          </Button>
          {!isEditor && (
            <Button
              variant={activeNavButton === 'forms' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                const isDesignRoute = routeType === 'layers' || routeType === 'page' || routeType === 'component';
                if (isDesignRoute) setLastDesignUrl(window.location.pathname + window.location.search);
                setOptimisticNav('forms');
                router.push(projectsPath('/forms'));
              }}
            >
              <Icon name="form" />
              Forms
            </Button>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 items-center justify-center">
        <LocaleSelector />
        <div className="h-5"><Separator orientation="vertical" /></div>
        <Button
          size="xs" variant="ghost"
          asChild
        >
          <a
            href={baseUrl + publishedUrl} target="_blank"
            rel="noopener noreferrer"
          >
            {baseUrl || 'https://beta.kolboschool.com'}
          </a>
        </Button>
      </div>
      <div className="flex items-center justify-end gap-2">
        <ActiveUsersInHeader />
        {canManageMembers && <InviteUserButton />}
        <div className="flex items-center justify-end w-16 text-xs text-zinc-500 dark:text-white/50">
          {isSaving ? <span>Saving</span> : hasUnsavedChanges ? <span>Unsaved</span> : lastSaved ? <span>Saved</span> : <span>Ready</span>}
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleTogglePreview}
          disabled={!currentPage || isSaving}
          className={isPreviewMode ? 'bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90' : ''}
        >
          <Icon name="preview" />
        </Button>
        <PublishPopover
          isPublishing={isPublishing}
          setIsPublishing={setIsPublishing}
          baseUrl={baseUrl}
          publishedUrl={publishedUrl}
          onPublishSuccess={onPublishSuccess}
        />
      </div>
    </header>
    <BackupRestoreDialog open={showTransferDialog} onOpenChange={setShowTransferDialog} />
    </>
  );
}
