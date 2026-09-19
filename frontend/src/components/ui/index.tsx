import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import { Seal } from "@/components/brand/seal";
import type { Tone } from "@/lib/labels";

import { cn } from "./cn";

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
          /* `w-fit` so the group is the tick plus the label and nothing else —
             as a full-width block, pointing anywhere along the empty right of
             the row would have lit the mark.

             The tick grows with the label it belongs to. It used to stand still
             while the link beside it scaled and drew its rule, which read as
             one half of a control answering and the other half stuck.

             `group-has-[a:hover]` and not `group-hover`: `.label-link` answers
             its own hover, so hovering the tick itself — or the 8px of gap
             between them — grew the tick while the label stayed at rest. That
             is the same half-answer, only inverted. Keyed to the link, the two
             now move together or not at all; an eyebrow that is plain text and
             not a link answers with nothing, which is correct. */
          <div className="record-label group flex w-fit items-center gap-2 text-[var(--accent)]">
            <span
              aria-hidden="true"
              className="h-3 w-px origin-center bg-[var(--accent)] transition-transform duration-200 group-focus-within:scale-y-150 group-has-[a:hover]:scale-y-150"
            />
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
          ? "border-[var(--border-strong)] shadow-[var(--shadow-md)]"
          : "border-[var(--border)]",
        className,
      )}
      style={style}
    >
      {variant === "featured" ? (
        // Rounded to match the card's own top corners, not clipped into
        // shape by a parent `overflow-hidden` — `.record-card`'s hover
        // adds a `filter: drop-shadow` bloom (globals.css) that an
        // `overflow-hidden` ancestor would truncate at its own edge.
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[3px] rounded-t-[var(--radius-md)] bg-[var(--gold)]"
        />
      ) : null}
      {children}
    </As>
  );
}

// ------------------------------------------------------------------- badge

/**
 * Materials, not a traffic light.
 *
 * The framework palette — blue for "info", green for "success", amber for
 * "warning" — was three hues that exist nowhere else in this design and
 * belong to no material in it. A register of fighters came out with blue
 * rank chips next to a green "active" club, which is the look of a
 * component library rather than of an archive.
 *
 * Each tone is a material the tradition actually uses, rendered as that
 * material rather than a chip that only changes fill colour — a status
 * struck, pinned, or aged onto the record, not a pill:
 *   tin       — plain plate: filed, nothing happening (a riveted tag)
 *   linen     — canvas: entered, waiting its turn (a stretched-canvas tag)
 *   wax       — the seal: this is happening now (a pulsing wax blob)
 *   brass     — struck metal: done, and it stands (a tilted double-stamp)
 *   ochre     — aged mark: true, with a caveat (a foxing stain under the word)
 *   ember     — the one hot thing: broken off, disqualified (a torn edge)
 *   highlight — not one of the six materials: a climax, not a caveat, for
 *               the one status (the tournament's FINAL stage) that used to
 *               share ochre's tone purely because a third colour was free.
 *               A slow gold shine across the letters instead of a stain.
 * `--live` for ember on purpose: it is the palette's "something is happening
 * right now" red, and a badge that says a thing went wrong is exactly the
 * moment to spend it.
 *
 * Typography: every material sets `.badge-hand` (globals.css) — a
 * handwritten cut, never uppercase (script + caps reads badly) — distinct
 * from `.record-label`'s typewriter voice used everywhere else on the site.
 */
const toneMaterialClass: Record<Tone, string> = {
  neutral: "badge-tin",
  info: "badge-linen",
  active: "badge-wax",
  success: "badge-stamp",
  warning: "badge-ochre",
  danger: "badge-ember",
  highlight: "badge-highlight",
};

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn("badge-hand whitespace-nowrap", toneMaterialClass[tone], className)}>{children}</span>
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
  headingLevel: HeadingTag = "h2",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Optional lucide icon (or any node) shown above the title — pass one that
   *  matches the context (a trophy for "no matches yet", users for "no
   *  participants", etc.) so empty states stop looking identical everywhere.
   *  It is framed by the shared seal so it reads as part of the mark system. */
  icon?: ReactNode;
  /** Defaults to h2 — every current call site sits under a page that
   *  already has its own h1, so h2 is correct without a caller having to
   *  think about it. Override only if a future page ever uses EmptyState
   *  as its sole content directly under a bare h1. */
  headingLevel?: "h2" | "h3";
}) {
  return (
    <div className="ledger-lines rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-6 py-10 text-center">
      <div className="mx-auto mb-4 w-fit">
        <Seal size={46} tone="muted">
          {icon ?? <span aria-hidden="true" className="font-record leading-none">—</span>}
        </Seal>
      </div>
      <HeadingTag className="font-display text-lg font-semibold">{title}</HeadingTag>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Alert's own tone treatment — a near-paper fill, unrelated to Badge's
 *  material stamps above (Alert is a margin note, not a status struck onto
 *  the record, and was never part of this redesign). */
const alertToneClasses: Record<Tone, string> = {
  neutral: "bg-[var(--surface-muted)] text-[var(--chrome-muted)] border-[var(--border-strong)]",
  info: "bg-[var(--surface-muted)] text-[var(--surface-paper)] border-[var(--surface-paper)]/25",
  active: "bg-[var(--accent-soft)] text-[var(--accent-strong)] border-[var(--accent)]/40",
  success: "bg-[var(--gold-soft)] text-[var(--gold-strong)] border-[var(--gold)]/35",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]/30",
  danger: "bg-[var(--live-soft)] text-[var(--live)] border-[var(--live)]/35",
  highlight: "bg-[var(--gold-soft)] text-[var(--gold-strong)] border-[var(--gold)]/35",
};

/** A margin note stamped against a solid coloured edge, not a rounded tinted
 *  box — the edge carries the severity so the fill can stay near-paper. */
const toneEdge: Record<Tone, string> = {
  neutral: "border-l-[var(--border-strong)]",
  info: "border-l-[var(--info)]",
  active: "border-l-[var(--accent)]",
  success: "border-l-[var(--success)]",
  warning: "border-l-[var(--warning)]",
  danger: "border-l-[var(--danger)]",
  highlight: "border-l-[var(--gold)]",
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
  // Every caller mounts this the moment there's something to say (a failed
  // submit, a validation error) — a sighted user sees it appear where the
  // button they just pressed was; a screen-reader user gets nothing unless
  // the mount itself is announced. `danger`/`warning` are interruptions
  // (`role="alert"` — assertive, WCAG 4.1.3 Status Messages); the rest are
  // incidental status, announced politely rather than cutting in.
  const isUrgent = tone === "danger" || tone === "warning";
  return (
    <div
      role={isUrgent ? "alert" : "status"}
      aria-live={isUrgent ? "assertive" : "polite"}
      className={cn(
        "rounded-[var(--radius-sm)] border border-l-[3px] px-4 py-3 text-sm leading-relaxed",
        alertToneClasses[tone],
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
