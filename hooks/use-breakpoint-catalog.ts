'use client';

import { useMemo } from 'react';
import {
  BREAKPOINT_CATALOG_SETTING,
  CANVAS_BREAKPOINT_FRAMES_SETTING,
  resolveBreakpointCatalog,
  setClientBreakpointCatalog,
  type BreakpointDefinition,
  type BreakpointMutation,
} from '@/lib/breakpoint-utils';
import { persistBreakpointBaseDemotion, persistBreakpointPrefixRewrite } from '@/lib/persist-breakpoint-prefix';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface BreakpointCatalogController {
  catalog: BreakpointDefinition[];
  commit: (mutation: BreakpointMutation) => Promise<BreakpointMutation>;
}

export function useBreakpointCatalog(): BreakpointCatalogController {
  const saved = useSettingsStore((state) => state.settingsByKey[BREAKPOINT_CATALOG_SETTING]);
  const legacyFrames = useSettingsStore((state) => state.settingsByKey[CANVAS_BREAKPOINT_FRAMES_SETTING]);
  const saveSettings = useSettingsStore((state) => state.saveSettings);
  const updateSetting = useSettingsStore((state) => state.updateSetting);

  const catalog = useMemo(
    () => resolveBreakpointCatalog(saved, legacyFrames),
    [saved, legacyFrames],
  );
  setClientBreakpointCatalog(catalog);

  const commit = async (mutation: BreakpointMutation) => {
    if (mutation.error) return mutation;
    updateSetting(BREAKPOINT_CATALOG_SETTING, mutation.catalog);
    setClientBreakpointCatalog(mutation.catalog);
    if (mutation.demoteBaseTo) {
      await persistBreakpointBaseDemotion(mutation.demoteBaseTo);
    }
    const rewrites = mutation.prefixRewrites
      ?? (mutation.prefixRewrite ? [mutation.prefixRewrite] : []);
    for (const rewrite of rewrites) {
      await persistBreakpointPrefixRewrite(rewrite.from, rewrite.to);
    }
    await saveSettings({ [BREAKPOINT_CATALOG_SETTING]: mutation.catalog });
    return mutation;
  };

  return { catalog, commit };
}
