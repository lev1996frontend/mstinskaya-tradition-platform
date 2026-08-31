import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import { Seal } from "@/components/brand/seal";
import type { Tone } from "@/lib/labels";

import { cn } from "./cn";
import { PulseDot } from "./pulse-dot";

export { cn };
// Interactive button primitives live in ./button (a "use client" module, for
// framer-motion's whileTap) and are re-exported here so existing imports
// from "@/components/ui" keep working — re-exporting doesn't pull the rest
// of this file into the client bundle, only the actual Button usages do.
export { Button, ButtonLink, type ButtonSize, type ButtonVariant } from "./button";

// ------------------------------------------------------------------ layout

export function Container({
  children,
  className,
  wide = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** Wider editorial max-width, reserved for the homepage masthead and the
   *  tournament hero header — so those moments feel bigger than a table page. */
  wide?: boolean;
} & Omit<ComponentPropsWithoutRef<"div">, "children" | "className">) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6", wide ? "max-w-7xl" : "max-w-6xl", className)} {...rest}>
      {children}
    </div>
  );
}

/**
 * The masthead of a filed record: a stamped field label, the editorial title,
 * and a cold double rule closing the block. Every page opens the same way, so
 * moving between sections feels like turning pages of one document rather
 * than visiting five differently-designed screens.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="rule-double-b flex flex-col gap-5 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-3">
        {eyebrow ? (
          <div className="record-label flex items-center gap-2 text-[var(--accent)]">
            <span aria-hidden="true" className="h-3 w-px bg-[var(--accent)]" />
            {eyebrow}
          </div>
        ) : null}
        <h1 className="font-display text-balance text-3xl font-semibold leading-[1.08] tracking-tight sm:text-[2.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/**
 * Section head as an index rule: the title sits on a hairline that runs to the
 * far edge, the way a heading sits on a ruled sheet. Replaces the old
 * title-left / link-right flex row, which was the generic dashboard shape.
 */
export function Section({
  title,
  description,
  actions,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      {title || actions ? (
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            {title ? (
              <h2 className="font-display shrink-0 text-xl font-semibold tracking-tight">{title}</h2>
            ) : null}
            <span aria-hidden="true" className="h-px flex-1 bg-[var(--rule)] opacity-70" />
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
          {description ? <p className="text-sm text-[var(--muted)]">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- стенка

/**
 * Two sides facing each other across a seam — the "стенка" composition.
 * Reserved for pairs that are genuinely two opposed sides (a bout's two
 * fighters, a team meeting's two teams), not a generic two-column layout.
 * Each side's primary text converges on the seam (left side right-aligns,
 * right side stays left-aligned) so the two columns read as facing off
 * rather than as two ordinary left-to-right blocks.
 */
export function TwoSided({
  left,
  right,
  mirror = false,
  className,
}: {
  left: ReactNode;
  right: ReactNode;
  /** Right-aligns the left side so both sides' text converges on the seam.
   *  Only safe when a side's own content is a plain vertical text stack —
   *  text-align does not reorder an internal flex row (an icon+text line
   *  stays pinned left), so leave this off for content built that way. */
  mirror?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-stretch", className)}>
      <div className={cn("min-w-0 flex-1", mirror && "sm:text-right")}>{left}</div>
      <span aria-hidden="true" className="hidden w-px shrink-0 bg-[var(--rule)] sm:block" />
      <div className="min-w-0 flex-1">{right}</div>
    </div>
  );
}

// -------------------------------------------------------------------- card

export function Card({
  children,
  className,
  style,
  as: As = "div",
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  /** Escape hatch for the rare card that is a genuinely different material
   *  (the champion record on paper) rather than another wood/charcoal
   *  surface — an inline style always wins over the class-based background,
   *  so it doesn't fight `bg-[var(--surface)]` for the same CSS property. */
  style?: CSSProperties;
  as?: "div" | "article" | "li";
  /** "featured" strikes a gold band across the top edge — reserve for one card
   *  per screen (next tournament, championship match) so it keeps meaning
   *  something. Replaces the old corner glyph: a filed-and-flagged record is
   *  marked on its edge, and an edge band survives at any card size, where a
   *  corner icon competed with whatever content sat in that corner. */
  variant?: "default" | "featured";
}) {
  return (
    <As
      className={cn(
        "relative rounded-[var(--radius-md)] border bg-[var(--surface)] shadow-[var(--shadow-sm)] transition-colors",
        variant === "featured"
          ? "overflow-hidden border-[var(--border-strong)] shadow-[var(--shadow-md)]"
          : "border-[var(--border)]",
        className,
      )}
      style={style}
    >
      {variant === "featured" ? (
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-[var(--gold)]" />
      ) : null}
      {children}
    </As>
  );
}

// ------------------------------------------------------------------- badge

/**
 * Badges are stamps, not pills. Square-cut, set in the record face, uppercase
 * and letterspaced — a status struck onto a document. The pill shape was the
 * single most SaaS-looking element in the old system and it appeared on
 * nearly every screen.
 */
const toneClasses: Record<Tone, string> = {
  neutral: "bg-[var(--surface-muted)] text-[var(--muted)] border-[var(--border-strong)]",
  info: "bg-[var(--info-soft)] text-[var(--info)] border-[var(--info)]/25",
  active: "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30",
  success: "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/25",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]/25",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/25",
};

export function Badge({
  children,
  tone = "neutral",
  pulse = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  /** Renders a small looping dot ahead of the label — for IN_PROGRESS/live states. */
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "record-label inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] border px-2 py-1",
        toneClasses[tone],
        className,
      )}
    >
      {pulse ? <PulseDot color={tone === "danger" ? "var(--danger)" : "var(--live)"} /> : null}
      {children}
    </span>
  );
}

// ------------------------------------------------------------------- state

/**
 * An unfilled record rather than a "nothing here" tile: paper stock, faint
 * writing rules, and an empty seal where the mark would be stamped once there
 * is something to file.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Optional lucide icon (or any node) shown above the title — pass one that
   *  matches the context (a trophy for "no matches yet", users for "no
   *  participants", etc.) so empty states stop looking identical everywhere.
   *  It is framed by the shared seal so it reads as part of the mark system. */
  icon?: ReactNode;
}) {
  return (
    <div className="ledger-lines rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-6 py-10 text-center">
      <div className="mx-auto mb-4 w-fit">
        <Seal size={46} tone="muted">
          {icon ?? <span aria-hidden="true" className="font-record leading-none">—</span>}
        </Seal>
      </div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** A margin note stamped against a solid coloured edge, not a rounded tinted
 *  box — the edge carries the severity so the fill can stay near-paper. */
const toneEdge: Record<Tone, string> = {
  neutral: "border-l-[var(--border-strong)]",
  info: "border-l-[var(--info)]",
  active: "border-l-[var(--accent)]",
  success: "border-l-[var(--success)]",
  warning: "border-l-[var(--warning)]",
  danger: "border-l-[var(--danger)]",
};

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-sm)] border border-l-[3px] px-4 py-3 text-sm leading-relaxed",
        toneClasses[tone],
        toneEdge[tone],
      )}
    >
      {title ? <p className="record-label mb-1.5">{title}</p> : null}
      {children ? <div className="text-[var(--foreground)]/85">{children}</div> : null}
    </div>
  );
}

// ------------------------------------------------------------------- table

/** Ledger table: cold rules top and bottom, stamped column heads, no zebra. */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="scroll-x rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
      <table className={cn("w-full min-w-[36rem] border-collapse text-sm", className)}>
        {children}
      </table>
    </div>
  );
}

/** Column heads are always stamped field labels, so they are always already in
 *  the record face with tabular figures — there is deliberately no `numeric`
 *  prop here (it exists on `Td`, where it actually changes the typeface).
 *  Mark a value column with `align="right"`. */
export function Th({
  children,
  className,
  align = "left",
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "record-label border-b-2 border-[var(--rule)] bg-[var(--surface-muted)]/60 px-4 py-2.5 text-[var(--chrome-muted)]",
        align === "center" && "text-center",
        align === "right" && "text-right",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
  numeric = false,
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
  /** Renders the cell in the record face with tabular figures — for scores,
   *  seeds, counts and dates, so columns of digits line up on the decimal. */
  numeric?: boolean;
}) {
  return (
    <td
      className={cn(
        "border-b border-[var(--border)] px-4 py-3 align-middle",
        align === "center" && "text-center",
        align === "right" && "text-right",
        numeric && "font-record",
        className,
      )}
    >
      {children}
    </td>
  );
}

// -------------------------------------------------------------------- misc

/** Form-style term/value pairs: stamped caption above the filled-in value. */
export function DefinitionList({ items }: { items: { term: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.term} className="min-w-0 border-t border-[var(--border)] pt-2">
          <dt className="record-label text-[var(--muted)]">{item.term}</dt>
          <dd className="mt-1 text-sm">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Pulsing placeholder block for loading.tsx skeletons — respects
 *  prefers-reduced-motion via the global CSS override in globals.css. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-muted)]", className)}
    />
  );
}

/** A single recorded value. The numeral is the subject, so it is set large in
 *  the record face — this is the clearest place the third type role earns
 *  itself, and it is why Stat no longer looks like a dashboard KPI tile. */
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-t-2 border-[var(--rule)] px-1 pt-2.5">
      <div className="record-label text-[var(--muted)]">{label}</div>
      <div className="font-record mt-1.5 text-2xl font-medium leading-none">{value}</div>
    </div>
  );
}
