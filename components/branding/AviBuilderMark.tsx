import type { SVGProps } from 'react';

type AviBuilderMarkProps = SVGProps<SVGSVGElement> & { title?: string };

/** Approved AVI mark, rendered in the active interface color. */
export default function AviBuilderMark({ title = 'AVI Builder', ...props }: AviBuilderMarkProps) {
  return (
    <svg viewBox="0 0 1000 1000" role="img" aria-label={title} fill="currentColor" fillRule="evenodd" {...props}>
      <title>{title}</title>
      <path d="M344 236 492 236 498 239 504 246 588 500 733 500 743 507 746 521 668 755 661 762 656 764 505 763 496 754 456 632 379 633 340 753 334 761 328 764 180 764 169 756 166 747 167 740 331 248 339 238 344 236ZM672 236 820 236 829 241 833 248 833 259 800 358 796 364 789 368 639 368 631 363 627 356 627 345 659 249 662 243 672 236ZM681 259 652 346 780 346 809 259 681 259ZM494 291 430 480 430 485 436 500 492 500 497 502 504 510 505 619 497 630 480 632 480 634 505 710 507 710 570 516 494 291ZM594 522 592 523 520 741 649 741 721 522 594 522Z" />
    </svg>
  );
}
