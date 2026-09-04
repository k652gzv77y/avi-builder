import AviBuilderMark from '@/components/branding/AviBuilderMark';

/** AVI Builder badge shown on published pages when enabled in project settings. */
export default function AviBadge() {
  return (
    <a
      href="https://avibuilder.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="This website was built using AVI Builder."
      className="fixed bottom-2.5 right-2.5 z-[9999] flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background shadow-sm"
    >
      <AviBuilderMark className="size-3" title="AVI Builder" />
      <span>Built with AVI Builder</span>
    </a>
  );
}

/** @deprecated Prefer AviBadge — kept as a named re-export for one release. */
export { AviBadge as YcodeBadge };
