import { cn } from '@/lib/utils';
import { AVI_ICONS } from '@/lib/avi-icons/generated';
import type { AviIconName } from '@/lib/avi-icons/generated';

export type { AviIconName };

interface AviIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'name'> {
  name: AviIconName;
  /** Width/height in pixels (icons are square). Defaults to 16. */
  size?: number;
}

/**
 * Renders an icon from the Avi icon set (see `public/icons`, generated into
 * `lib/avi-icons/generated.ts`). Icons use `currentColor`, so set the color via
 * text color / `className`. The markup is build-time generated from our own SVG
 * assets, so inlining it is safe (no runtime/user input).
 */
export function AviIcon({ name, size = 16, className, ...props }: AviIconProps) {
  const body = AVI_ICONS[name];

  if (!body) {
    return null;
  }

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      className={cn('inline-block shrink-0', className)}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: body }}
      {...props}
    />
  );
}

export default AviIcon;
