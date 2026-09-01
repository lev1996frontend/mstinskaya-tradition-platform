"use client";

import { HandsIcon, KistenIcon, NozhIcon, PalkaIcon } from "@/components/brand/weapon-glyphs";
import type { BracketCell, BracketColumn } from "./bracket-data";
import { WEAPON_LABELS, buildBracket } from "./bracket-data";
import { useTournamentPathActions, useTournamentPathState } from "./tournament-path-context";
import type { TournamentPathState } from "./tournament-path-context";

const FACE_ICONS = { hands: HandsIcon, palka: PalkaIcon, nozh: NozhIcon, kisten: KistenIcon } as const;

/**
 * One round's label + cells, shared by the mobile (plain 2-col grid, no
 * connectors — a 4-round tree doesn't fit that layout) and desktop (flex row
 * joined by `BracketConnector`) variants below, so the two can never drift
 * apart in cell markup.
 */
function ColumnBlock({
  column,
  ri,
  state,
  pick,
}: {
  column: BracketColumn;
  ri: number;
  state: TournamentPathState;
  pick: (name: string) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex h-9 items-end">
        <span className="record-label text-[var(--text-4)]">{column.label}</span>
      </div>
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
              // No `hover:translate-x` here anymore: `BracketConnector`'s
              // lines/arrowheads are positioned with fixed percentage math
              // that has no idea a cell just shifted, so a 4px nudge closed
              // the gap and drove the incoming arrowhead into the card's own
              // left border on hover. A box-shadow ring gives the same "this
              // one's interactive" feedback without moving the box at all —
              // nothing for the connector geometry to fall out of sync with.
              className="step-in relative flex h-[54px] flex-col justify-center gap-0.5 border px-3.5 text-left transition-[background-color,border-color,box-shadow] duration-300 disabled:cursor-default enabled:hover:shadow-[inset_0_0_0_1px_var(--accent)]"
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
  );
}

/**
 * The elbow connectors joining one round to the next, drawn as plain divs
 * scaled in with `.draw-x`/`.draw-y` (globals.css) rather than SVG paths —
 * those two classes exist specifically for this ("bracket connector lines
 * drawing in") but were never wired into any markup. Position math mirrors
 * `RoundConnector` in `features/tournaments/bracket-view.tsx`: both round
 * columns distribute their cells with `justify-around` inside a fixed-height
 * area, so a cell's vertical center is exactly `(2i+1)/(2n)` of that height —
 * no runtime DOM measurement needed. A pair's final segment (into the target
 * cell) reads in gold once that cell has a real name instead of "—", so the
 * line visibly "arrives" as the visitor's run resolves that slot.
 */
function BracketConnector({
  fromCount,
  toCount,
  targetCells,
  roundIndex,
}: {
  fromCount: number;
  toCount: number;
  targetCells: BracketCell[];
  roundIndex: number;
}) {
  if (fromCount === 0 || toCount === 0 || fromCount !== toCount * 2) {
    return <div className="w-10 shrink-0" aria-hidden="true" />;
  }

  const pairs = Array.from({ length: toCount }, (_, k) => k);
  const stagger = roundIndex * 0.12;

  return (
    <div className="flex w-14 shrink-0 flex-col" aria-hidden="true">
      <div className="mb-3 h-9" />
      <div className="relative flex-1">
        {pairs.map((k) => {
          const topY = ((2 * (2 * k) + 1) / (2 * fromCount)) * 100;
          const bottomY = ((2 * (2 * k + 1) + 1) / (2 * fromCount)) * 100;
          const midY = ((2 * k + 1) / (2 * toCount)) * 100;
          const resolved = targetCells[k]?.name !== "—";
          const delay = stagger + k * 0.06;

          return (
            <div key={k}>
              <span
                className="draw-x absolute left-0 h-px w-1/2"
                style={{ top: `${topY}%`, background: "var(--border-strong)", animationDelay: `${delay}s` }}
              />
              <span
                className="draw-x absolute left-0 h-px w-1/2"
                style={{ top: `${bottomY}%`, background: "var(--border-strong)", animationDelay: `${delay}s` }}
              />
              <span
                className="draw-y absolute left-1/2 w-px"
                style={{
                  top: `${topY}%`,
                  height: `${bottomY - topY}%`,
                  background: "var(--border-strong)",
                  animationDelay: `${(delay + 0.14).toFixed(2)}s`,
                }}
              />
              <span
                className="draw-x absolute left-1/2 h-px w-1/2"
                style={{
                  top: `${midY}%`,
                  background: resolved ? "var(--gold)" : "var(--border-strong)",
                  opacity: resolved ? 1 : 0.45,
                  animationDelay: `${(delay + 0.28).toFixed(2)}s`,
                }}
              />
              {/* Стрелка — only once this pair actually has a winner (target
                  cell holds a name, not "—"): a pairing still being fought
                  (or not yet reached) gets the plain waiting line above, no
                  arrowhead. Vertical centering lives on this outer wrapper,
                  not the animated triangle itself — `.draw-x`'s keyframes
                  drive `transform: scaleX(...)` on the element they're
                  applied to, which would silently clobber an inline
                  `translateY(-50%)` set on that same element. */}
              {resolved ? (
                <span
                  aria-hidden="true"
                  className="absolute right-0"
                  style={{ top: `${midY}%`, transform: "translateY(-50%)" }}
                >
                  <span
                    className="draw-x block"
                    style={{
                      width: 0,
                      height: 0,
                      borderTop: "4px solid transparent",
                      borderBottom: "4px solid transparent",
                      borderLeft: "6px solid var(--gold)",
                      animationDelay: `${(delay + 0.34).toFixed(2)}s`,
                    }}
                  />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

        {/* Mobile: a 4-round tree doesn't fit a real connected tree below
            `sm`, so it degrades to a plain 2-col grid — same cells, no
            lines. */}
        <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-10 sm:hidden">
          {columns.map((column, ri) => (
            <ColumnBlock key={column.label} column={column} ri={ri} state={state} pick={pick} />
          ))}
        </div>

        {/* Desktop / tablet: the same four rounds joined by real bracket
            connector lines, so this reads as an actual bracket instead of
            four unrelated lists. */}
        <div className="mt-10 hidden items-stretch sm:flex">
          {columns.map((column, ri) => {
            const nextColumn = columns[ri + 1];
            return (
              <div key={column.label} className="flex flex-1">
                <div className="min-w-0 flex-1">
                  <ColumnBlock column={column} ri={ri} state={state} pick={pick} />
                </div>
                {nextColumn ? (
                  <BracketConnector
                    fromCount={column.cells.length}
                    toCount={nextColumn.cells.length}
                    targetCells={nextColumn.cells}
                    roundIndex={ri}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
