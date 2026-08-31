"use client";

import { WEAPON_LABELS } from "./bracket-data";
import { KineticName } from "./kinetic-name";
import { HandsIcon, KistenIcon, NozhIcon, PalkaIcon } from "@/components/brand/weapon-glyphs";

const FACE_ICONS = { hands: HandsIcon, palka: PalkaIcon, nozh: NozhIcon, kisten: KistenIcon } as const;

/**
 * Scene photo is deliberately generic documentary stock, not a per-fighter
 * portrait — same reasoning as the dossier cards in `dossiers.tsx`: there is
 * no open-licensed photo of a specific named fighter, so the frame is dressed
 * with the tradition's own documentary photography rather than implying a
 * likeness that doesn't exist.
 */
const SCENE_PHOTO = {
  left: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Lob_Kulachni_boi.jpg/1920px-Lob_Kulachni_boi.jpg",
  right:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Lob_Stenka_na_stenku.jpg/1920px-Lob_Stenka_na_stenku.jpg",
} as const;

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
    <div
      className={`flex flex-col gap-4 ${isLeft ? "items-end" : "items-start"}`}
      style={{ perspective: 1200 }}
    >
      <div
        className={`relative aspect-[4/3] w-full max-w-[22rem] overflow-hidden border border-[var(--iron)] ${
          clashing ? (isLeft ? "lunge-a" : "lunge-b") : ""
        }`}
        style={{ transformStyle: "preserve-3d", transform: `rotateY(${isLeft ? 9 : -9}deg)` }}
      >
        <img
          src={SCENE_PHOTO[side]}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
          style={{ filter: "grayscale(.5) sepia(.22) contrast(1.1) brightness(.72)" }}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: `linear-gradient(${isLeft ? "90deg" : "270deg"}, rgba(16,14,12,.75), transparent 60%)`,
          }}
        />
        {badge && BadgeIcon ? (
          <span
            className={`record-label absolute bottom-2.5 inline-flex items-center gap-2 px-2.5 py-1.5 text-[var(--gold)] ${
              isLeft ? "right-3" : "left-3"
            }`}
            style={{ background: "rgba(16,14,12,.8)" }}
          >
            <BadgeIcon size={14} />
            {badge.label}
          </span>
        ) : null}
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
