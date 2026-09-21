"use client";

import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";

import { cn } from "./index";

// Square-cut, iron-edged fields: boxes ruled onto a form. The old rounded-lg
// control was the other half (with the pill badge) of the generic-SaaS read.
// Inset ring rather than the global `:focus-visible` outline: an outline can
// get clipped by an `overflow-x-clip` ancestor (several forms sit in one, to
// contain an unrelated hover bleed elsewhere on the page), which made the
// focus ring vanish on exactly the fields that most need it to be visible.
const controlClasses =
  "w-full rounded-[var(--radius-sm)] border border-[var(--chrome-line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors placeholder:text-[var(--muted)] hover:border-[var(--chrome-muted)] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--gold)] disabled:opacity-60";

export function Field({
  label,
  hideLabel = false,
  hint,
  error,
  children,
}: {
  label: string;
  /** For the rare field directly under a section heading that already names
   *  the one thing in it — a second identical-looking `record-label` caption
   *  right underneath read as duplicated information, not a field label.
   *  Keeps the label in the DOM for screen readers, just not painted. */
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: (props: { id: string; "aria-describedby": string | undefined }) => ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      {/* the same stamped caption used above every other value in the system */}
      <label htmlFor={id} className={cn("record-label block text-[var(--chrome-muted)]", hideLabel && "sr-only")}>
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
  // Input/Textarea are text-entry, so they keep the caret cursor; a select is
  // click-to-open like a button, and native selects don't get a pointer
  // cursor by default in every browser.
  return <select className={cn(controlClasses, "cursor-pointer", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClasses, "min-h-20 resize-y", className)} {...props} />;
}
