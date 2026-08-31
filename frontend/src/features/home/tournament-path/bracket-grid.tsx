"use client";

import { HandsIcon, KistenIcon, NozhIcon, PalkaIcon } from "@/components/brand/weapon-glyphs";
import { WEAPON_LABELS, buildBracket } from "./bracket-data";
import { useTournamentPathActions, useTournamentPathState } from "./tournament-path-context";

const FACE_ICONS = { hands: HandsIcon, palka: PalkaIcon, nozh: NozhIcon, kisten: KistenIcon } as const;

/**
 * "Карта состязания" — the bracket grid, built from the same `buildBracket`
 * source `poedinok.tsx`'s ladder uses (see `bracket-data.ts`), so the two
 * sections can never disagree about who is where.
 */
export function BracketGrid() {
  const state = useTournamentPathState();
  const { pick, declare } = useTournamentPathActions();
  const columns = buildBracket(state.runFighter, state.runStep, state.runOver);
  const pickerOpen = !!state.picked;

  return (
    <section id="setka" className="border-b border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto w-full max-w-[88rem] px-6 py-20 sm:px-10 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-10 border-b border-[var(--border)] pb-5">
          <div>
            <span className="record-label text-[var(--gold)]">Л. 05 · Путь</span>
            <h2 className="font-display m-0 mt-3.5 text-[3rem] font-bold tracking-tight">Карта состязания</h2>
          </div>
          <div className="flex flex-col items-end gap-3.5">
            <p className="max-w-md text-right text-[0.9375rem] leading-relaxed text-[var(--text-3)]">
              {state.picked
                ? `Путь бойца: ${state.picked}. Иконка справа от имени — заявленный разряд, его можно сменить здесь же.`
                : "Сетка — не таблица, а карта: нажмите имя, чтобы проследить путь бойца и сменить его разряд. Иконка у имени — заявленный снаряд."}
            </p>
            {pickerOpen ? (
              <div className="flex items-center gap-2">
                <span className="record-label text-[var(--gold)]">Заявленный разряд</span>
                {WEAPON_LABELS.map(({ key, label }, i) => {
                  const Icon = FACE_ICONS[key];
                  const active = state.picked ? state.declared[state.picked] === i : false;
                  return (
                    <button
                      key={key}
                      type="button"
                      title={label}
                      onClick={() => state.picked && declare(state.picked, i)}
                      className="grid size-9 cursor-pointer place-items-center border transition-colors"
                      style={{
                        background: active ? "var(--surface-muted)" : "transparent",
                        borderColor: active ? "var(--accent)" : "var(--border-strong)",
                        color: active ? "var(--accent)" : "var(--text-4)",
                      }}
                    >
                      <Icon size={19} />
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4 sm:gap-x-14">
          {columns.map((column, ri) => (
            <div key={column.label}>
              <span className="record-label block pb-3.5 text-[var(--text-4)]">{column.label}</span>
              <div className="flex flex-col justify-around gap-2" style={{ height: 560 }}>
                {column.cells.map((cellData, i) => {
                  const mine = state.runFighter === cellData.name;
                  const on = state.picked === cellData.name || mine;
                  const beaten = state.beaten.includes(cellData.name);
                  const weaponIndex = state.declared[cellData.name];
                  const WeaponIcon = weaponIndex !== undefined ? FACE_ICONS[WEAPON_LABELS[weaponIndex].key] : null;
                  return (
                    <button
                      key={`${column.label}-${i}`}
                      type="button"
                      onClick={() => cellData.name !== "—" && pick(cellData.name)}
                      disabled={cellData.name === "—"}
                      className="step-in relative flex h-[54px] flex-col justify-center gap-0.5 border px-3.5 text-left transition-[background-color,border-color,transform] duration-300 disabled:cursor-default enabled:hover:translate-x-1"
                      style={{
                        background: mine ? "#2A1A16" : on || beaten ? "var(--surface)" : "var(--surface-muted)",
                        borderColor: mine ? "var(--accent)" : beaten ? "var(--accent-deep)" : on ? "var(--accent)" : "var(--border)",
                        color: on || beaten ? "var(--foreground)" : "var(--muted)",
                        animationDelay: `${(ri * 0.35 + i * 0.05).toFixed(2)}s`,
                      }}
                    >
                      <span className="flex items-center justify-between gap-2.5">
                        <span className="truncate text-sm font-medium">{cellData.name}</span>
                        {WeaponIcon ? (
                          <span
                            className="grid size-4 shrink-0 place-items-center"
                            style={{ color: on ? "var(--accent)" : "var(--gold)" }}
                          >
                            <WeaponIcon size={16} />
                          </span>
                        ) : null}
                      </span>
                      <span className="record-label" style={{ color: beaten ? "var(--accent-deep)" : "var(--text-4)" }}>
                        {beaten ? "пройден" : cellData.club}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
