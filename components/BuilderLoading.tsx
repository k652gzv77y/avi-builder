'use client';

import AviBuilderMark from '@/components/branding/AviBuilderMark';

interface BuilderLoadingProps {
  title?: string;
  message?: string;
  progress?: number;
}

export default function BuilderLoading({
  title = 'AVI Builder',
  message = 'Loading...',
  progress,
}: BuilderLoadingProps) {
  const width = typeof progress === 'number' ? Math.max(8, Math.min(100, progress)) : undefined;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background text-foreground">
      <div className="flex w-56 flex-col items-center gap-5">
        <AviBuilderMark className="size-8 text-foreground" title={title} />
        <div className="h-[2px] w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className={width == null ? 'h-full w-1/3 rounded-full bg-foreground/80 animate-[avi-load_1.1s_ease-in-out_infinite]' : 'h-full rounded-full bg-foreground/80 transition-[width] duration-300'}
            style={width == null ? undefined : { width: `${width}%` }}
          />
        </div>
        <p className="text-center text-[11px] text-muted-foreground">{message}</p>
      </div>
      <style jsx>{''}</style>
    </div>
  );
}
