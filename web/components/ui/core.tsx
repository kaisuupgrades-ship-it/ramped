import * as React from "react";
import { cn } from "@/lib/cn";

/* ============================================================================
   Core primitives — Card, Input, Textarea, Label, Field, Pill, Badge.
   Kept in one file because they're trivial and constantly used together.
   ========================================================================== */

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)]",
        "border border-line rounded-[20px] p-8",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full h-11 px-3.5 rounded-xl bg-bg-2 border border-line-2 text-text-0",
        "text-[14.5px] placeholder:text-text-3",
        "focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/30",
        "transition-colors",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full px-3.5 py-3 rounded-xl bg-bg-2 border border-line-2 text-text-0",
        "text-[14.5px] placeholder:text-text-3 leading-relaxed font-sans resize-none",
        "focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/30",
        "transition-colors",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-xs font-mono uppercase tracking-[0.08em] text-text-3 mb-2",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3.5", className)}>
      {label && <Label>{label}</Label>}
      {children}
      {error ? (
        <p className="mt-1.5 text-[12.5px] text-bad">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12.5px] text-text-3">{hint}</p>
      ) : null}
    </div>
  );
}

export interface PillProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  active?: boolean;
}

export function Pill({ active, className, children, ...props }: PillProps) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 cursor-pointer select-none",
        "px-3.5 py-2 rounded-full text-[13.5px] font-medium",
        "border transition-all duration-150",
        active
          ? "bg-blue/10 border-blue/40 text-blue-2"
          : "bg-bg-2 border-line-2 text-text-1 hover:border-line-2 hover:text-text-0 hover:bg-bg-3",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: "neutral" | "good" | "blue" | "orange" | "purple" | "red";
  className?: string;
  children: React.ReactNode;
}) {
  const colors = {
    neutral: "bg-bg-3 border-line text-text-2",
    good: "bg-good/10 border-good/35 text-good",
    blue: "bg-blue/10 border-blue/35 text-blue-2",
    orange: "bg-orange/10 border-orange/40 text-orange-2",
    purple: "bg-purple/10 border-purple/40 text-purple",
    red: "bg-bad/10 border-bad/40 text-bad",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
        "text-[11px] font-mono font-semibold uppercase tracking-[0.06em] border",
        colors[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block font-mono text-[11px] uppercase tracking-[0.1em] text-blue-2 font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}
