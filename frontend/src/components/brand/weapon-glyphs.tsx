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
 * `/tournaments` lot cube's two non-outcome faces) and have no domain meaning.
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

/**
 * The protective mask, in the same single-color line-art family as the four
 * weapon glyphs above — used wherever a fighter's category hasn't been
 * declared/drawn yet (`fighter-card.tsx`'s empty slot, mirroring
 * `helmet-reveal.tsx`'s own "no weapon chosen yet → mask" convention on the
 * homepage hero). Not a weapon motif itself, so deliberately kept out of
 * `WEAPON_MOTIFS`/`WeaponMotifKey`.
 */
export function MaskIcon({ className, size = 24 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 4 C8.4 4 6.2 6.8 6.2 10.6 C6.2 15.4 8.6 18.6 12 19.6 C15.4 18.6 17.8 15.4 17.8 10.6 C17.8 6.8 15.6 4 12 4 Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M7.4 9.4 H16.6 M7.4 12.2 H16.6 M7.6 15 H16.4" stroke="currentColor" strokeWidth="1" opacity="0.65" />
    </svg>
  );
}

export type WeaponMotifKey = "hands" | "kisten" | "palka" | "nozh";

/**
 * Exactly the 4 real lot-drawn categories — do not extend this array.
 * `weapon-draw-billet.tsx` hardcodes 90°-per-face (`360 / WEAPON_MOTIFS.length`)
 * cube rotation math and rolls a real-looking lot from `WEAPON_MOTIFS.length`;
 * adding `krug`/`stenka` here would make that illustrative-but-real-mechanic
 * widget sometimes "draw" a face with no domain meaning. The `/tournaments` lot
 * cube (6 faces, 2 of them decorative) is a different, purpose-built
 * component in `features/tournaments/tournament-path/` — it imports `KrugIcon`/
 * `StenkaIcon` directly alongside these four, not through this constant.
 */
/**
 * `genitive` is the form after «против» in `clash-card.tsx`'s matchup
 * caption ("Нож против Палки", not the ungrammatical "Нож против Палка") —
 * «против» always governs the genitive case in Russian, regardless of which
 * motif is doing the grammatical governing (`b`, the second slot).
 */
/**
 * `description` is the equipment glossary line `hero-clash.tsx`'s
 * "Знаки традиции" row shows on hover — what the snaryad physically is, not
 * a competition rule (judges, staging, victory conditions stay backend-driven
 * via `describeWeaponRule` in `features/equipment/equipment.tsx`). Wording
 * confirmed directly by the tradition's own organiser, not invented.
 */
export const WEAPON_MOTIFS: { key: WeaponMotifKey; label: string; genitive: string; description: string; Icon: ComponentType<GlyphProps> }[] = [
  {
    key: "hands",
    label: "Безоружный",
    genitive: "безоружного",
    description: "Безоружный — боец выходит с голыми руками, без какого-либо снаряда.",
    Icon: HandsIcon,
  },
  {
    key: "kisten",
    label: "Кистень",
    genitive: "кистеня",
    description: "Кистень — верёвка с узлом «обезьяний кулак» на конце; снаряд разряда.",
    Icon: KistenIcon,
  },
  {
    key: "palka",
    label: "Палка",
    genitive: "палки",
    description: "Палка — пластиковая труба, обмотанная поролоном; безопасный снаряд разряда.",
    Icon: PalkaIcon,
  },
  {
    key: "nozh",
    label: "Нож",
    genitive: "ножа",
    description: "Нож — деревянный муляж ножа; снаряд разряда.",
    Icon: NozhIcon,
  },
];

/**
 * "Живая сшибка" opponent picker for the click-to-clash animation
 * (`clash-card.tsx`, `hero-clash.tsx`, `monogram-flip.tsx`). Decorative
 * pairing only, not a real draw rule. The design canvas's own auto-cycling
 * prototype (`ClashPreview.dc.html`) used a fixed 4-step sequence
 * (hands→nozh, nozh→palka, palka→hands, kistenʹ→kistenʹ) — picking uniformly
 * at random over all four motifs (including the clicked one itself, so a
 * mirrored duel like kistenʹ-vs-kistenʹ can still come up) covers that same
 * set of pairings plus every other combination, so every trigger can land on
 * a different matchup instead of the same handful repeating.
 */
export function randomWeaponMotif(): WeaponMotifKey {
  return WEAPON_MOTIFS[Math.floor(Math.random() * WEAPON_MOTIFS.length)].key;
}
