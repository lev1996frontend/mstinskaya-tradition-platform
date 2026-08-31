"use client";

import { HandsIcon, KistenIcon, NozhIcon, PalkaIcon } from "@/components/brand/weapon-glyphs";
import { WEAPON_LABELS } from "./bracket-data";
import { useTournamentPathState } from "./tournament-path-context";

const FACE_ICONS = { hands: HandsIcon, palka: PalkaIcon, nozh: NozhIcon, kisten: KistenIcon } as const;

export function JournalPanel() {
  const state = useTournamentPathState();

  return (
    <div className="border border-[var(--border)] bg-[var(--surface-muted)]">
      <span className="record-label block border-b border-[var(--border)] px-5 py-4 text-[var(--text-4)]">
        Журнал круга
      </span>
      {state.journal.length === 0 ? (
        <p className="px-5 py-4 text-sm text-[var(--text-3)]">Записей пока нет.</p>
      ) : (
        state.journal.map((entry, i) => (
          <div key={`${entry.time}-${i}`} className="step-in flex gap-4 border-b border-[var(--border)] px-5 py-3.5">
            <span className="font-record shrink-0 text-xs text-[var(--text-4)]">{entry.time}</span>
            <span className="text-sm leading-normal text-[var(--muted)]">{entry.text}</span>
          </div>
        ))
      )}
      <div className="flex gap-px bg-[var(--border)]">
        {WEAPON_LABELS.map(({ key, label }, i) => {
          const Icon = FACE_ICONS[key];
          const count = state.tally[i];
          const active = state.phase === "result" && state.lot === i;
          const color = active ? "var(--accent)" : "var(--muted)";
          return (
            <span
              key={key}
              title={label}
              className="flex flex-1 flex-col items-center gap-1.5 bg-[var(--surface-muted)] px-3 py-3.5"
            >
              <span className="grid size-4 place-items-center" style={{ color }}>
                <Icon size={16} />
              </span>
              <span className="font-record text-[0.9375rem]" style={{ color }}>
                {count}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
