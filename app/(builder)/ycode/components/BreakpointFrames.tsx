'use client';

const FRAMES = [
  { id: 'desktop' as const, label: 'Desktop', width: 1200 },
  { id: 'tablet' as const, label: 'Tablet', width: 810 },
  { id: 'mobile' as const, label: 'Phone', width: 390 },
];

export default function BreakpointFrames({
  active,
  zoom,
  onSelect,
  children,
}: {
  active: 'desktop' | 'tablet' | 'mobile' | 'all';
  zoom: number;
  onSelect: (mode: 'desktop' | 'tablet' | 'mobile') => void;
  children: React.ReactNode;
}) {
  const scale = zoom / 100;
  return (
    <div className="flex items-start gap-10">
      {FRAMES.map((frame) => {
        const isActive = active === frame.id || (active === 'all' && frame.id === 'desktop');
        return (
          <div key={frame.id} className="flex flex-col items-start gap-2">
            <div className="flex items-baseline gap-2 text-[11px] text-neutral-500 dark:text-white/40">
              <span className="font-medium text-neutral-800 dark:text-white/80">{frame.label}</span>
              <span>{frame.width}</span>
            </div>
            {isActive ? (
              children
            ) : (
              <button
                type="button"
                onClick={() => onSelect(frame.id)}
                className="overflow-hidden rounded-[10px] bg-white shadow-[0_18px_40px_rgba(0,0,0,0.08)] outline outline-black/5 dark:bg-[#111] dark:outline-white/10"
                style={{ width: frame.width * scale, height: Math.max(420, 820 * scale) }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
