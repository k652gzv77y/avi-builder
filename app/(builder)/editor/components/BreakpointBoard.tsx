'use client';

import { Button } from '@/components/ui/button';
import { useBreakpointCatalog } from '@/hooks/use-breakpoint-catalog';
import { breakpointLabel } from '@/lib/breakpoint-utils';
import type { Breakpoint } from '@/types';

export default function BreakpointBoard({
  previewUrl,
  onSelectBreakpoint,
}: {
  desktopWidth?: number;
  tabletWidth?: number;
  phoneWidth?: number;
  previewUrl?: string;
  onSelectBreakpoint: (mode: Breakpoint) => void;
}) {
  const { catalog } = useBreakpointCatalog();

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-14 z-40 overflow-auto bg-[#f4f4f5] dark:bg-[#0c0c0d]"
    >
      <div className="flex min-h-full items-start justify-center gap-8 px-10 py-8">
        {catalog.map((frame) => {
          const scale = frame.width >= 1000 ? 0.42 : frame.width >= 700 ? 0.52 : 0.72;
          const label = breakpointLabel(frame.id, catalog);
          return (
            <button
              key={frame.id}
              type="button"
              onClick={() => onSelectBreakpoint(frame.id)}
              className="group flex flex-col items-start gap-2 text-left"
            >
              <div className="flex items-baseline gap-2 text-[11px] text-neutral-500 dark:text-white/45">
                <span className="font-medium text-neutral-800 dark:text-white/80">{label}</span>
                <span>{frame.width}</span>
              </div>
              <div
                className="overflow-hidden rounded-[10px] bg-white shadow-[0_18px_50px_rgba(0,0,0,0.12)] outline outline-black/5 transition group-hover:outline-black/20 dark:bg-[#111] dark:outline-white/10"
                style={{ width: frame.width * scale, height: 820 * scale }}
              >
                {previewUrl ? (
                  <iframe
                    title={label}
                    src={previewUrl}
                    className="origin-top-left border-0 bg-white pointer-events-none"
                    style={{
                      width: frame.width,
                      height: 820,
                      transform: `scale(${scale})`,
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                    {label}
                  </div>
                )}
              </div>
              <Button
                size="xs"
                variant="ghost"
                className="h-6 px-2 text-[11px] text-neutral-500"
              >
                Edit {label}
              </Button>
            </button>
          );
        })}
      </div>
    </div>
  );
}
