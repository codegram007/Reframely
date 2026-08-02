import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** Mark-only (no wordmark). */
  markOnly?: boolean;
}

/**
 * Reframely logo. The mark is a stylized layered-stack glyph (nodes
 * nesting into nodes — the Section/Row/Column/Widget tree) in the brand
 * violet gradient.
 */
export function Logo({ className, markOnly = false }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="relative inline-flex h-7 w-7 items-center justify-center">
        <svg viewBox="0 0 28 28" fill="none" className="h-7 w-7" aria-hidden="true">
          <rect
            x="1"
            y="1"
            width="26"
            height="26"
            rx="7"
            fill="url(#vs-grad)"
          />
          <path
            d="M9 8.5h10M9 13.5h7M9 18.5h4"
            stroke="white"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="vs-grad" x1="1" y1="1" x2="27" y2="27" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(248 95% 70%)" />
              <stop offset="1" stopColor="hsl(268 88% 58%)" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      {!markOnly && (
        <span className="text-lg font-semibold tracking-tight text-foreground">
          Reframely
        </span>
      )}
    </span>
  );
}
