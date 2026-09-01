"use client";

import { Seal } from "@/components/brand/seal";
import { WEAPON_MOTIFS, type WeaponMotifKey } from "@/components/brand/weapon-glyphs";

const ICON_BY_MOTIF = Object.fromEntries(WEAPON_MOTIFS.map((motif) => [motif.key, motif.Icon]));
const LABEL_BY_MOTIF = Object.fromEntries(WEAPON_MOTIFS.map((motif) => [motif.key, motif.label]));
const GENITIVE_BY_MOTIF = Object.fromEntries(WEAPON_MOTIFS.map((motif) => [motif.key, motif.genitive]));

/**
 * Flavor lines for the delayed result line — decorative "Наглядно" text, not
 * a real result (see `poedinok.tsx`'s identical framing: results here are
 * illustration, never a claim about actual judging outcomes). The canvas
 * prototype only ever showed one of these ("удар в голову — соступ взят",
 * kept first/default); the rest are new in the same illustrative register,
 * picked by the caller so repeated triggers don't all read identically.
 */
export const CLASH_RESULT_LINES = [
  "удар в голову — соступ взят",
  "чистый уход — дистанция разорвана",
  "захват сорван — попытка не защитана",
  "снаряд выбит — снова в стойку",
] as const;

/**
 * "Сшибка · наглядно" — a direct port of the design canvas's `ClashPreview`
 * artboard (`ClashPreview.dc.html`, direction 2 of the hero exploration):
 * the bordered specimen-plate frame with four corner ticks, two filled seals
 * lunging together over a "—" divider, a matchup caption, and a delayed
 * result line. Every class/size/color here (the 84px seals, the 220px duel
 * row, the gold `.strike-ring`) was read back off the running prototype
 * rather than redrawn from memory.
 *
 * `nonce` forces a remount (and therefore replays the animation) when the
 * same matchup is triggered twice in a row — React wouldn't otherwise see a
 * prop change to replay `.lunge-a`/`.lunge-b`/etc. against.
 */
export function ClashCard({
  a,
  b,
  nonce,
  result = CLASH_RESULT_LINES[0],
}: {
  a: WeaponMotifKey;
  b: WeaponMotifKey;
  nonce: number;
  result?: string;
}) {
  const IconA = ICON_BY_MOTIF[a];
  const IconB = ICON_BY_MOTIF[b];

  return (
    <div key={nonce} className="relative overflow-hidden border border-[var(--border-strong)] bg-[var(--surface-muted)] pt-[30px]">
      <span aria-hidden="true" className="tick" style={{ top: 10, left: 10, borderTop: "1.5px solid var(--gold)", borderLeft: "1.5px solid var(--gold)" }} />
      <span aria-hidden="true" className="tick" style={{ top: 10, right: 10, borderTop: "1.5px solid var(--gold)", borderRight: "1.5px solid var(--gold)" }} />
      <span aria-hidden="true" className="tick" style={{ bottom: 10, left: 10, borderBottom: "1.5px solid var(--gold)", borderLeft: "1.5px solid var(--gold)" }} />
      <span aria-hidden="true" className="tick" style={{ bottom: 10, right: 10, borderBottom: "1.5px solid var(--gold)", borderRight: "1.5px solid var(--gold)" }} />

      <p className="record-label m-0 text-center text-[var(--muted)]">Сшибка · наглядно</p>

      <div className="relative flex h-[220px] items-center justify-center gap-9">
        <span aria-hidden="true" className="flash absolute inset-0 m-auto size-28 rounded-full" style={{ background: "radial-gradient(circle, rgba(176,42,32,.55), transparent 70%)" }} />
        <span aria-hidden="true" className="strike-ring absolute inset-0 m-auto size-16" />
        <span className="lunge-a">
          <Seal size={84} tone="accent" filled>
            <IconA size={38} />
          </Seal>
        </span>
        <span className="record-label text-lg text-[var(--gold)]" style={{ letterSpacing: 0 }}>
          —
        </span>
        <span className="lunge-b">
          <Seal size={84} tone="accent" filled>
            <IconB size={38} />
          </Seal>
        </span>
      </div>

      <p className="record-label pop-in m-0 mt-1.5 text-center text-[0.875rem] text-[var(--foreground)]">
        {/* «против» governs the genitive case — b takes `genitive`, not `label` */}
        {LABEL_BY_MOTIF[a]} <span className="text-[var(--muted)]">против</span> {GENITIVE_BY_MOTIF[b]}
      </p>
      <p
        className="pop-in m-0 mt-1.5 h-5 text-center text-[0.6875rem] uppercase tracking-[0.14em] text-[var(--accent)]"
        style={{ fontFamily: "var(--font-record)", animationDelay: "450ms" }}
      >
        {result}
      </p>

      <div className="my-5 flex justify-center gap-2 pb-1">
        {WEAPON_MOTIFS.map((motif) => (
          <span
            key={motif.key}
            aria-hidden="true"
            className="size-1.5 rounded-full"
            style={{ background: motif.key === a ? "var(--gold)" : "var(--border-strong)" }}
          />
        ))}
      </div>
    </div>
  );
}
