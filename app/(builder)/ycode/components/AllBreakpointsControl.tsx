'use client';

import { useMemo, useState } from 'react';
import BreakpointBoard from './BreakpointBoard';

export default function AllBreakpointsControl() {
  const [open, setOpen] = useState(false);
  const previewUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return '/projects/kolbo-school/preview';
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed left-1/2 top-[3.85rem] z-[60] -translate-x-1/2 rounded-md border border-black/10 bg-background px-2.5 py-1 text-[11px] text-foreground shadow-sm dark:border-white/10"
      >
        {open ? 'Edit breakpoint' : 'All breakpoints'}
      </button>
      {open && (
        <BreakpointBoard
          previewUrl={previewUrl}
          onSelectBreakpoint={() => setOpen(false)}
        />
      )}
    </>
  );
}
