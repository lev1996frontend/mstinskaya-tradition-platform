"use client";

import { WEAPON_LABELS } from "./bracket-data";
import { KineticName } from "./kinetic-name";
import { HandsIcon, KistenIcon, NozhIcon, PalkaIcon } from "@/components/brand/weapon-glyphs";
import { GearMaskIllustration } from "@/components/brand/gear-mask-illustration";

const FACE_ICONS = { hands: HandsIcon, palka: PalkaIcon, nozh: NozhIcon, kisten: KistenIcon } as const;

export function FighterCard({
  side,
  name,
  club,
  score,
  isWinner,
  declaredWeapon,
  clashing,
}: {
  side: "left" | "right";
  name: string;
  club: string;
  score: number | null;
  isWinner: boolean;
  declaredWeapon: number | undefined;
  clashing: boolean;
}) {
  const isLeft = side === "left";
  const badge = declaredWeapon !== undefined ? WEAPON_LABELS[declaredWeapon] : null;
  const BadgeIcon = badge ? FACE_ICONS[badge.key] : null;

  return (
    // `perspective` lives on the shared grid row in `poedinok.tsx`, not here —
    // this wrapper just needs `preserve-3d` to let that one vanishing point
    // reach the tilted card two levels down, so both cards read as facing a
    // single center (the lot cube) instead of each tilting in its own
    // independent 3D space.
    /* Centred while the cards are stacked, hugging their own side of the cube
       once the row splits in three: mirrored alignment on a phone put one
       card's name hard right and the other's hard left, one under the other,
       which read as two columns that failed to line up. */
    <div
      /* Written as whole class names, never `lg:${...}` — Tailwind scans the
         source for complete strings and generates nothing for a class that is
         only assembled at runtime. */
      className={`flex flex-col items-center gap-4 ${isLeft ? "lg:items-end" : "lg:items-start"}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* The tilt is a class, not an inline transform, so it can be dropped
          below `lg` — see `.duel-card` in globals.css. The two cards only face
          each other while they sit either side of the cube; once the row
          collapses to one column they are stacked, and a 16° turn on a card
          with nothing opposite it just reads as knocked askew. */}
      <div
        data-side={side}
        className={`duel-card relative aspect-[4/3] w-full max-w-[22rem] overflow-hidden border border-[var(--iron)] ${
          clashing ? (isLeft ? "lunge-a" : "lunge-b") : ""
        }`}
        style={{
          transformStyle: "preserve-3d",
          background: "var(--surface-muted)",
        }}
      >
        {badge && BadgeIcon ? (
          <>
            {/* No photo — there is no open-licensed picture of a specific named
                fighter, and a stock "scene" shot risked implying a likeness that
                doesn't exist. The declared weapon's own glyph, faint and
                oversized, stands in as the frame's content instead — same "no
                fabricated faces" rule the dossier cards in `dossiers.tsx` follow. */}
            <span aria-hidden="true" className="absolute inset-0 grid place-items-center text-[var(--border-strong)]">
              <BadgeIcon size={104} />
            </span>
            <span
              className={`record-label absolute bottom-2.5 inline-flex items-center gap-2 px-2.5 py-1.5 text-[var(--gold)] ${
                isLeft ? "right-3" : "left-3"
              }`}
              style={{ background: "rgba(16,14,12,.8)" }}
            >
              <BadgeIcon size={14} />
              {badge.label}
            </span>
          </>
        ) : (
          // No weapon declared yet — the mask, same "not chosen → mask"
          // convention as the homepage hero's illustration
          // (`helmet-reveal.tsx`), with ripples reading as "still waiting on
          // the жребий" rather than the card just sitting inert.
          <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
            <span style={{ position: "relative", width: 168, height: 168 }}>
              <span className="mask-ripple" style={{ animationDelay: "0ms" }} />
              <span className="mask-ripple" style={{ animationDelay: "930ms" }} />
              <span className="mask-ripple" style={{ animationDelay: "1860ms" }} />
              <span className="absolute inset-0 grid place-items-center">
                <span className="relative" style={{ width: 112, height: 112 * 1.3 }}>
                  <GearMaskIllustration hovering={false} staticFallback />
                </span>
              </span>
            </span>
          </span>
        )}
      </div>

      <div className={`text-center ${isLeft ? "lg:text-right" : "lg:text-left"}`}>
        <span className="record-label text-[var(--text-4)]">{club}</span>
        <KineticName name={name} align={isLeft ? "right" : "left"} />
        <p className="font-record mt-2 text-[2rem] leading-none" style={{ color: isWinner ? "var(--accent)" : "var(--text-4)" }}>
          {score === null ? "—" : score}
        </p>
      </div>
    </div>
  );
}
