'use client';

import { useMemo, useState } from 'react';

export type ColorStyle = {
  id: string;
  name: string;
  light: string;
  dark: string;
};

const DEFAULT_STYLES: ColorStyle[] = [
  { id: 'gray-1', name: 'Gray 1', light: '#f5f5f5', dark: '#f5f5f5' },
  { id: 'gray-2', name: 'Gray 2', light: '#e5e5e5', dark: '#d4d4d4' },
  { id: 'gray-3', name: 'Gray 3', light: '#a3a3a3', dark: '#737373' },
  { id: 'gray-4', name: 'Gray 4', light: '#737373', dark: '#525252' },
  { id: 'gray-5', name: 'Gray 5', light: '#404040', dark: '#262626' },
  { id: 'gray-6', name: 'Gray 6', light: '#171717', dark: '#0a0a0a' },
  { id: 'green-light', name: 'Green Light', light: '#d7f5e3', dark: '#1b3d2a' },
];

export default function ColorStylePicker({
  value,
  onChange,
  onClose,
}: {
  value: ColorStyle | null;
  onChange: (style: ColorStyle) => void;
  onClose?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [hex, setHex] = useState(value?.light || '#F0F3F8');
  const [mode, setMode] = useState<'solid' | 'linear' | 'radial' | 'image'>('solid');
  const styles = useMemo(
    () => DEFAULT_STYLES.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  return (
    <div className="w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1f] text-[12px] text-white shadow-2xl">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[13px] font-medium">Color</span>
        {onClose && (
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white">
            ×
          </button>
        )}
      </div>
      <div className="flex gap-1 px-3">
        {(['solid', 'linear', 'radial', 'image'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={`h-7 flex-1 rounded-md text-[10px] ${
              mode === item ? 'bg-white/12 text-white' : 'text-white/35'
            }`}
          >
            {item === 'solid' ? '●' : item === 'linear' ? '■' : item === 'radial' ? '◉' : '▲'}
          </button>
        ))}
      </div>
      <div className="mx-3 mt-2 h-28 rounded-xl bg-gradient-to-br from-black via-neutral-500 to-amber-200" />
      <div className="mt-2 px-3">
        <div className="h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 via-30% via-green-400 via-55% via-blue-500 to-purple-500" />
        <div className="mt-2 h-1.5 rounded-full bg-gradient-to-r from-black to-white" />
      </div>
      <div className="mt-3 flex gap-2 px-3">
        <input
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          className="h-8 flex-1 rounded-lg bg-black/40 px-2 font-mono text-[12px] outline-none ring-1 ring-[#0099ff]"
        />
        <div className="h-8 w-16 rounded-lg bg-black/40 px-2 leading-8 text-center text-white/70">100%</div>
      </div>
      <div className="mt-2 flex gap-2 px-3">
        <div className="h-8 flex-1 rounded-lg bg-black/40 px-2 leading-8 text-white/50">HEX</div>
        <button type="button" className="h-8 w-10 rounded-lg bg-black/40 text-white/50">
          ↗
        </button>
      </div>
      <div className="mt-3 border-t border-white/8 px-3 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="h-8 w-full rounded-lg bg-black/30 px-2 text-[12px] outline-none placeholder:text-white/30"
        />
        <ul className="mt-1 max-h-40 overflow-auto">
          {styles.map((style) => (
            <li key={style.id}>
              <button
                type="button"
                onClick={() => onChange(style)}
                className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-white/6"
              >
                <span className="h-4 w-4 rounded-full border border-white/15" style={{ background: style.light }} />
                <span>{style.name}</span>
                {value?.id === style.id && <span className="ml-auto text-white/35">•</span>}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="mt-1 w-full rounded-lg py-2 text-center text-white/45 hover:bg-white/5">
          New Style
        </button>
      </div>
    </div>
  );
}
