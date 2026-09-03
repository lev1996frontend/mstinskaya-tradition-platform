import type { ReactNode } from "react";

import { cn } from "@/components/ui/cn";

import type { WeaponMotifKey } from "./weapon-glyphs";
import { WEAPON_MOTIFS } from "./weapon-glyphs";

/**
 * The stamped seal frame — the single presentational shape that turns any
 * glyph into a struck mark. It exists so the weapon glyphs stop being "four
 * loose icons" and start reading as one issued set, and so unrelated icons
 * elsewhere (empty states, section marks) inherit the same grammar.
 *
 * Geometry is an octagon rather than a circle: it echoes the cut corners of
 * the stamped-plate `Monogram` and, unlike a circle, still reads as struck
 * metal at 20px. The double outline (heavy edge + inset hairline) is the
 * whole treatment — no fill gradient, no glow, no shadow.
 */

/** Regular octagon inscribed in a `size`-square viewBox, inset by `inset`. */
function octagonPath(size: number, inset: number): string {
  const r = size / 2 - inset;
  const cx = size / 2;
  const points = Array.from({ length: 8 }, (_, i) => {
    // start at 22.5° so the octagon sits flat-topped
    const angle = (Math.PI / 4) * i + Math.PI / 8;
    return `${(cx + r * Math.cos(angle)).toFixed(2)} ${(cx + r * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${points.join(" L")} Z`;
}

const OUTER = octagonPath(48, 2);
const INNER = octagonPath(48, 6.5);

export type SealTone = "iron" | "accent" | "gold" | "muted";

const toneClass: Record<SealTone, string> = {
  iron: "text-[var(--iron)]",
  accent: "text-[var(--accent)]",
  gold: "text-[var(--gold)]",
  muted: "text-[var(--muted)]",
};

export function Seal({
  children,
  size = 44,
  tone = "iron",
  filled = false,
  accented = false,
  className,
}: {
  /** Any glyph — a weapon motif, a lucide icon, a numeral. */
  children: ReactNode;
  size?: number;
  tone?: SealTone;
  /** Struck-and-inked variant: solid ground, knocked-out glyph. Reserve it for
   *  the one seal that is the subject of a screen, not for every seal. */
  filled?: boolean;
  /**
   * Fades in a bolder retrace of the outer ring — a static hover/focus
   * accent (~160ms opacity, nothing else) that replaces animating the seal
   * itself. An earlier pass scaled the whole seal (ring + glyph together)
   * on hover; scaling a ~17px glyph with ~1.5px strokes visibly wobbles from
   * antialiasing recalculating every frame, even though it never actually
   * shifts position (verified with `getBoundingClientRect`). The glyph and
   * ring now stay at a fixed size always — only this extra outline reacts.
   */
  accented?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", toneClass[tone], className)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 48 48"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        fill="none"
      >
        <path d={OUTER} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" />
        <path
          d={OUTER}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          style={{ opacity: accented ? 1 : 0, transition: "opacity 160ms ease" }}
        />
        <path
          d={INNER}
          stroke={filled ? "var(--surface)" : "currentColor"}
          strokeWidth="0.9"
          opacity={filled ? 0.55 : 0.45}
        />
      </svg>
      <span
        className={cn("relative grid place-items-center", filled && "text-[var(--surface)]")}
        style={{ width: size * 0.46, height: size * 0.46 }}
      >
        {children}
      </span>
    </span>
  );
}

/**
 * A weapon motif inside the seal frame, optionally with its stamped caption.
 * Additive on purpose: `WEAPON_MOTIFS` and the four glyph components keep
 * their existing exports and signatures, so consumers that need a bare glyph
 * (per-bout weapon display in the tournament module) are unaffected.
 */
export function WeaponSeal({
  motif,
  size = 44,
  tone = "iron",
  filled = false,
  showLabel = false,
  className,
}: {
  motif: WeaponMotifKey;
  size?: number;
  tone?: SealTone;
  filled?: boolean;
  showLabel?: boolean;
  className?: string;
}) {
  const entry = WEAPON_MOTIFS.find((item) => item.key === motif) ?? WEAPON_MOTIFS[0];
  const { Icon, label } = entry;

  const seal = (
    <Seal size={size} tone={tone} filled={filled} className={className}>
      <Icon size={Math.round(size * 0.44)} />
    </Seal>
  );

  if (!showLabel) {
    return (
      <span className="inline-flex" title={label}>
        {seal}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-center gap-2 text-center">
      {seal}
      <span className="record-label text-[var(--muted)]">{label}</span>
    </span>
  );
}
