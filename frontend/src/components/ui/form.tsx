"use client";

import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";

import { cn } from "./index";

// Square-cut, iron-edged fields: boxes ruled onto a form. The old rounded-lg
// control was the other half (with the pill badge) of the generic-SaaS read.
const controlClasses =
  "w-full rounded-[var(--radius-sm)] border border-[var(--iron-line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors placeholder:text-[var(--muted)] hover:border-[var(--iron-muted)] disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: (props: { id: string; "aria-describedby": string | undefined }) => ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      {/* the same stamped caption used above every other value in the system */}
      <label htmlFor={id} className="record-label block text-[var(--iron-muted)]">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy })}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-[var(--muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClasses, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(controlClasses, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClasses, "min-h-20 resize-y", className)} {...props} />;
}
