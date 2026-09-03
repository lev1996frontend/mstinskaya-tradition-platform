"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";

import { HandsIcon, KistenIcon, NozhIcon, PalkaIcon } from "@/components/brand/weapon-glyphs";
import { ScrollTrigger, useGSAP } from "@/lib/gsap";
import { TURN_EASE } from "@/lib/motion";
import type { BracketCell, BracketColumn } from "./bracket-data";
import { WEAPON_LABELS, buildBracket } from "./bracket-data";
import { useTournamentPathActions, useTournamentPathState } from "./tournament-path-context";
import type { TournamentPathState } from "./tournament-path-context";

const FACE_ICONS = { hands: HandsIcon, palka: PalkaIcon, nozh: NozhIcon, kisten: KistenIcon } as const;

// Same slide language as the "Экспонаты" archive slider two sections down
// (`gear-archive.tsx`'s `slideVariants`) — a reader who already learned that
// gesture there shouldn't have to learn a second one here.
const roundSlideVariants: Variants = {
  enter: (direction: 1 | -1) => ({ opacity: 0, x: `${direction * 36}%` }),
  center: { opacity: 1, x: "0%" },
  exit: (direction: 1 | -1) => ({ opacity: 0, x: `${direction * -36}%` }),
};

/**
 * One round's label + cells, shared by the mobile (plain 2-col grid, no
 * connectors — a 4-round tree doesn't fit that layout) and desktop (flex row
 * joined by `BracketConnector`) variants below, so the two can never drift
 * apart in cell markup.
 *
 * `layout="tree"` (desktop) pins every column to the same fixed height with
 * `justify-around` because `BracketConnector`'s line math assumes it — a
 * cell's vertical center has to be a fixed fraction of that shared height.
 * `layout="flow"` (mobile) drops both: there's no connector to stay aligned
 * with there, so a round with 8 cells and a round with 1 cell (Сходка /
 * Победитель) each just take the height their own cells need instead of both
 * stretching to match the tallest round, which used to leave a huge blank
 * gap under the one-or-two-cell rounds.
 */
function ColumnBlock({
  column,
  ri,
  state,
  pick,
  layout,
}: {
  column: BracketColumn;
  ri: number;
  state: TournamentPathState;
  pick: (name: string) => void;
  layout: "tree" | "flow";
}) {
  return (
    <div>
      <div className="mb-3 flex h-9 items-end">
        <span className="record-label text-[var(--text-4)]">{column.label}</span>
      </div>
      <div
        className={layout === "tree" ? "flex flex-col justify-around gap-2" : "flex flex-col gap-3"}
        style={layout === "tree" ? { height: 560 } : undefined}
      >
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
  const wrapRef = useRef<HTMLDivElement>(null);
  // Undrawn (paused mid-keyframe, held at the `.draw-x`/`.draw-y` `from`
  // state by `animation-fill-mode: both`) until this connector's own round
  // scrolls into view — was previously a fixed `animationDelay` off mount
  // time, which fired the whole tree's lines before a reader on a tall page
  // had scrolled anywhere near "Л. 05". Geometry/timing/arrowhead logic
  // below is unchanged; only when playback starts moved from "on mount" to
  // "on scroll".
  const [inView, setInView] = useState(false);

  useGSAP(
    () => {
      if (!wrapRef.current) return;
      const trigger = ScrollTrigger.create({
        trigger: wrapRef.current,
        start: "top 85%",
        once: true,
        onEnter: () => setInView(true),
      });
      return () => trigger.kill();
    },
    { scope: wrapRef, dependencies: [] },
  );

  if (fromCount === 0 || toCount === 0 || fromCount !== toCount * 2) {
    return <div className="w-10 shrink-0" aria-hidden="true" />;
  }

  const pairs = Array.from({ length: toCount }, (_, k) => k);
  const stagger = roundIndex * 0.12;
  const playState = inView ? "running" : "paused";

  return (
    <div ref={wrapRef} className="flex w-14 shrink-0 flex-col" aria-hidden="true">
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
                style={{
                  top: `${topY}%`,
                  background: "var(--border-strong)",
                  animationDelay: `${delay}s`,
                  animationPlayState: playState,
                }}
              />
              <span
                className="draw-x absolute left-0 h-px w-1/2"
                style={{
                  top: `${bottomY}%`,
                  background: "var(--border-strong)",
                  animationDelay: `${delay}s`,
                  animationPlayState: playState,
                }}
              />
              <span
                className="draw-y absolute left-1/2 w-px"
                style={{
                  top: `${topY}%`,
                  height: `${bottomY - topY}%`,
                  background: "var(--border-strong)",
                  animationDelay: `${(delay + 0.14).toFixed(2)}s`,
                  animationPlayState: playState,
                }}
              />
              <span
                className="draw-x absolute left-1/2 h-px w-1/2"
                style={{
                  top: `${midY}%`,
                  background: resolved ? "var(--gold)" : "var(--border-strong)",
                  opacity: resolved ? 1 : 0.45,
                  animationDelay: `${(delay + 0.28).toFixed(2)}s`,
                  animationPlayState: playState,
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
                      animationPlayState: playState,
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

  // Mobile round pager: one round on screen at a time, `Назад`/`Следующий`
  // stepping between them. Replaces an earlier plain 2-col grid of all 4
  // rounds at once — dropping the fixed-height tree layout there had fixed
  // that version's dead-space bug but also left it reading as four unrelated
  // lists with no sense of a bracket at all. Clamped, not wrapped, like a
  // book's pages: "Круг 1" and "Победитель" are real endpoints, not a loop.
  const [mobileRound, setMobileRound] = useState(0);
  const [mobileDirection, setMobileDirection] = useState<1 | -1>(1);
  const reduceMotion = useReducedMotion();

  // Both read `current` from the functional-update callback rather than the
  // `mobileRound` closure: two calls landing in the same render tick (e.g. a
  // fast double-tap on "Следующий") would otherwise both compute their
  // target off the same stale `mobileRound` and land on the same round
  // instead of advancing twice. `stepRound` additionally takes a *delta*
  // rather than an absolute target for exactly that reason — an absolute
  // `mobileRound + 1` computed at click-time has the same staleness problem
  // even inside a functional updater, since the `+ 1` already happened
  // against the stale value before `setMobileRound` ever runs.
  function stepRound(delta: 1 | -1) {
    setMobileRound((current) => {
      const clamped = Math.max(0, Math.min(columns.length - 1, current + delta));
      if (clamped === current) return current;
      setMobileDirection(delta);
      return clamped;
    });
  }

  function goToRound(target: number) {
    setMobileRound((current) => {
      const clamped = Math.max(0, Math.min(columns.length - 1, target));
      if (clamped === current) return current;
      setMobileDirection(clamped > current ? 1 : -1);
      return clamped;
    });
  }

  return (
    <section id="setka" className="border-b border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto w-full max-w-[88rem] px-6 py-20 sm:px-10 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-10 border-b border-[var(--border)] pb-5">
          <div>
            <span className="record-label text-[var(--gold)]">Путь</span>
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
            `sm`, so instead of showing all rounds at once (with either dead
            space or four disconnected lists — both tried and rejected) this
            pages through them one at a time, mirroring the "Экспонаты"
            archive slider's own Назад/Следующий + counter + slide pattern
            further down the page. */}
        {/* `layout` on this outer card lets framer-motion animate its own
            height smoothly whenever the round inside changes size (Круг 1's
            8 cards vs. Победитель's 1) instead of the box snapping straight
            to the new height — which reads as everything below it (nav bar,
            the rest of the page) jumping on every tap. */}
        <motion.div
          layout
          transition={{ layout: { duration: 0.35, ease: TURN_EASE } }}
          className="mt-10 border border-[var(--border-strong)] bg-[var(--surface-muted)] sm:hidden"
        >
          <div className="flex items-baseline justify-between border-b border-[var(--border)] px-5 py-3">
            <span className="record-label text-[var(--gold)]">Карта · раунд</span>
            <span className="record-label text-[var(--muted)]">
              {mobileRound + 1} / {columns.length}
            </span>
          </div>

          <div className="overflow-hidden px-5 py-6">
            <AnimatePresence mode="wait" initial={false} custom={mobileDirection}>
              <motion.div
                key={mobileRound}
                custom={mobileDirection}
                variants={reduceMotion ? undefined : roundSlideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: TURN_EASE }}
              >
                <ColumnBlock column={columns[mobileRound]} ri={mobileRound} state={state} pick={pick} layout="flow" />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* `gap-4` is a floor, not the whole story: the dot rail takes
              `flex-1 justify-center` so it's always the true horizontal
              center of the bar with the leftover space split evenly on
              both sides — Назад/Следующий stay pinned to the edges instead
              of everything huddling together whenever the buttons' own text
              leaves little slack for `justify-between` to distribute. */}
          <div className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-4">
            <button
              type="button"
              onClick={() => stepRound(-1)}
              disabled={mobileRound === 0}
              aria-label="Предыдущий раунд"
              className="record-label shrink-0 border border-[var(--border-strong)] px-2.5 py-2.5 text-[var(--muted)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)] disabled:pointer-events-none disabled:opacity-30"
            >
              ← Назад
            </button>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5" role="tablist" aria-label="Раунды">
              {columns.map((column, i) => (
                <button
                  key={column.label}
                  type="button"
                  role="tab"
                  aria-selected={i === mobileRound}
                  aria-label={column.label}
                  onClick={() => goToRound(i)}
                  className="h-1.5 rounded-full transition-[width,background-color]"
                  style={{
                    width: i === mobileRound ? 18 : 6,
                    background: i === mobileRound ? "var(--gold)" : "var(--border-strong)",
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => stepRound(1)}
              disabled={mobileRound === columns.length - 1}
              aria-label="Следующий раунд"
              className="record-label shrink-0 border border-[var(--border-strong)] px-2.5 py-2.5 text-[var(--muted)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)] disabled:pointer-events-none disabled:opacity-30"
            >
              Следующий →
            </button>
          </div>
        </motion.div>

        {/* Desktop / tablet: the same four rounds joined by real bracket
            connector lines, so this reads as an actual bracket instead of
            four unrelated lists. */}
        <div className="mt-10 hidden items-stretch sm:flex">
          {columns.map((column, ri) => {
            const nextColumn = columns[ri + 1];
            return (
              <div key={column.label} className="flex flex-1">
                <div className="min-w-0 flex-1">
                  <ColumnBlock column={column} ri={ri} state={state} pick={pick} layout="tree" />
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
