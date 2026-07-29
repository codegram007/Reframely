import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const iconButtonVariants = cva(
  'inline-flex items-center justify-center rounded-md transition-all duration-150 ease-out-expo ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' +
    'disabled:pointer-events-none disabled:opacity-50 select-none active:scale-95',
  {
    variants: {
      variant: {
        ghost: 'text-foreground-muted hover:bg-surface-sunken hover:text-foreground',
        solid: 'bg-surface border border-border text-foreground hover:bg-surface-sunken',
        accent: 'bg-accent text-accent-foreground hover:bg-accent-hover',
      },
      size: {
        sm: 'h-7 w-7',
        md: 'h-9 w-9',
        lg: 'h-10 w-10',
      },
      active: {
        true: 'bg-accent-subtle text-accent',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
      active: false,
    },
  },
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  /** Accessible label — icon-only buttons need one. */
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, active, label, ...props }, ref) => (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(iconButtonVariants({ variant, size, active }), className)}
      {...props}
    />
  ),
);
IconButton.displayName = 'IconButton';
