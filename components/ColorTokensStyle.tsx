'use client';

import { useEffect } from 'react';
import { useColorVariablesStore } from '@/stores/useColorVariablesStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

export default function ColorTokensStyle() {
  const css = useColorVariablesStore((s) => s.generateCssDeclarations());
  const modes = useSettingsStore((s) => s.settingsByKey['variable_modes']);
  const modeValues = useSettingsStore((s) => s.settingsByKey['color_variable_mode_values']);

  useEffect(() => {
    const STYLE_ID = 'avi-builder-color-vars';
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = useColorVariablesStore.getState().generateCssDeclarations();
  }, [css, modes, modeValues]);

  return null;
}
