"use client";

import { WEAPON_LABELS } from "./bracket-data";
import { KineticName } from "./kinetic-name";
import { HandsIcon, KistenIcon, NozhIcon, PalkaIcon } from "@/components/brand/weapon-glyphs";
import { MaskGlyph } from "@/components/brand/mask-glyph";

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
    <div className={`flex flex-col gap-4 ${isLeft ? "items-end" : "items-start"}`} style={{ transformStyle: "preserve-3d" }}>
      <div
        className={`relative aspect-[4/3] w-full max-w-[22rem] overflow-hidden border border-[var(--iron)] ${
          clashing ? (isLeft ? "lunge-a" : "lunge-b") : ""
        }`}
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateY(${isLeft ? 16 : -16}deg)`,
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
                <MaskGlyph size={112} />
              </span>
            </span>
          </span>
        )}
      </div>

      <div className={isLeft ? "text-right" : "text-left"}>
        <span className="record-label text-[var(--text-4)]">{club}</span>
        <KineticName name={name} align={isLeft ? "right" : "left"} />
        <p className="font-record mt-2 text-[2rem] leading-none" style={{ color: isWinner ? "var(--accent)" : "var(--text-4)" }}>
          {score === null ? "—" : score}
        </p>
      </div>
    </div>
  );
}
