'use client';

import { useEffect } from 'react';
import { useColorVariablesStore } from '@/stores/useColorVariablesStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

function syncIframeThemes() {
  const dark = document.documentElement.classList.contains('dark');
  document.querySelectorAll('iframe').forEach((frame) => {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      doc.documentElement.classList.toggle('dark', dark);
      doc.documentElement.classList.toggle('light', !dark);
    } catch {
      /* cross-origin preview frames are ignored */
    }
  });
}

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
    syncIframeThemes();
    const observer = new MutationObserver(syncIframeThemes);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const timer = window.setInterval(syncIframeThemes, 1000);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [css, modes, modeValues]);

  return null;
}
