/**
 * The tradition's four lot-drawn categories: unarmed hands, kistenʹ (a
 * weighted head on a short chain), palka (stick) and nozh (knife). Same
 * single-color line-art language as `CornerMark`/`CrestRoundel` — thin
 * strokes, `currentColor`, no literal illustration — so the glyphs read as
 * one family at both icon size (dividers, motif rows) and scaled up (helmet,
 * draw billet faces).
 *
 * `WEAPON_MOTIFS` is presentational config only, colocated here on purpose:
 * the real backend weapon enum is `WeaponCategory` in `@/types` (see
 * `features/tournaments/weapon-mark.tsx` for the domain-typed bridge) — this
 * list must never be imported as if it were that type, since it also carries
 * `krug`/`stenka` below, which are decorative-only (header nav backs, the
 * homepage lot cube's two non-outcome faces) and have no domain meaning.
 */
import type { ComponentType } from "react";

type GlyphProps = { className?: string; size?: number };

export function HandsIcon({ className, size = 24 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="7" cy="7.5" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="7.5" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 10.1 L10.5 17.5 L13.5 17.5 L17 10.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function KistenIcon({ className, size = 24 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M6 20 L10.5 13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10.5 13.5 L13 10.8 L12 9.4 L14.3 8.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16.2" cy="6.3" r="2.7" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function PalkaIcon({ className, size = 24 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M5.5 19.5 L18.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.7 17.1 L9.4 15.3 M14.6 9.7 L16.3 7.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function NozhIcon({ className, size = 24 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M5 19 L13.5 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M13.5 10.5 L18.7 5.3 C19.3 4.7 19.9 5.3 19.4 6.1 L15.2 12.8 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6.6 17.4 L8.1 18.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function KrugIcon({ className, size = 24 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function StenkaIcon({ className, size = 24 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 6 L20 6 M4 12 L20 12 M4 18 L20 18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export type WeaponMotifKey = "hands" | "kisten" | "palka" | "nozh";

/**
 * Exactly the 4 real lot-drawn categories — do not extend this array.
 * `weapon-draw-billet.tsx` hardcodes 90°-per-face (`360 / WEAPON_MOTIFS.length`)
 * cube rotation math and rolls a real-looking lot from `WEAPON_MOTIFS.length`;
 * adding `krug`/`stenka` here would make that illustrative-but-real-mechanic
 * widget sometimes "draw" a face with no domain meaning. The homepage lot
 * cube (6 faces, 2 of them decorative) is a different, purpose-built
 * component in `features/home/tournament-path/` — it imports `KrugIcon`/
 * `StenkaIcon` directly alongside these four, not through this constant.
 */
export const WEAPON_MOTIFS: { key: WeaponMotifKey; label: string; Icon: ComponentType<GlyphProps> }[] = [
  { key: "hands", label: "Безоружный", Icon: HandsIcon },
  { key: "kisten", label: "Кистень", Icon: KistenIcon },
  { key: "palka", label: "Палка", Icon: PalkaIcon },
  { key: "nozh", label: "Нож", Icon: NozhIcon },
];
