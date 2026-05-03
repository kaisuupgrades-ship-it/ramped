import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const baseStyles =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-orange-2 to-orange text-[#1a0e05] shadow-[0_4px_12px_-2px_rgba(251,146,60,0.30)] hover:shadow-[0_6px_18px_-2px_rgba(251,146,60,0.45)] hover:-translate-y-px",
  secondary:
    "bg-bg-3 text-text-0 border border-line-2 hover:bg-bg-4 hover:border-line-2",
  ghost:
    "text-text-1 hover:text-text-0 hover:bg-bg-3",
  outline:
    "border border-line-2 text-text-0 hover:border-blue hover:text-blue-2",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[14.5px]",
  lg: "h-14 px-7 text-base",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  href?: string;
  external?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", href, external, className, children, ...props }, ref) => {
    const classes = cn(baseStyles, variants[variant], sizes[size], className);
    if (href) {
      const linkProps = external ? { href, target: "_blank", rel: "noopener noreferrer" } : { href };
      return (
        <Link {...linkProps} className={classes}>
          {children}
        </Link>
      );
    }
    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
