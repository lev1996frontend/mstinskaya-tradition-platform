"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import type { ReactNode } from "react";

import { WEAPON_LABELS, buildLadder, INITIAL_DECLARED, opponentAt, pairIndexOf } from "./bracket-data";

export type Phase = "idle" | "declare" | "ready" | "throw" | "pause" | "result" | "bout" | "clash" | "over";

export type JournalEntry = { time: string; text: string };

export type TournamentPathState = {
  phase: Phase;
  rx: number;
  ry: number;
  /** The weapon the throw already landed on, set the moment the throw
   *  starts — "pause" holds it unrevealed for its own dramatic beat, but the
   *  cube's own rotation is never waiting on anything past `THROW_LOT_START`.
   *  Read by `THROW_LOT_RESULT`, which needs no payload of its own because
   *  of it — see `confirmSpin`'s doc comment below for why. */
  pendingWeapon: number | null;
  lot: number | null;
  lotCount: number;
  tally: [number, number, number, number];
  journal: JournalEntry[];
  picked: string | null;
  declared: Record<string, number>;
  round: number;
  exchanges: number[];
  scores: [number, number];
  runFighter: string | null;
  runStep: number;
  beaten: string[];
  runOver: "out" | "champion" | null;
};

const initialState: TournamentPathState = {
  phase: "idle",
  rx: -18,
  ry: 24,
  pendingWeapon: null,
  lot: null,
  lotCount: 0,
  tally: [0, 0, 0, 0],
  journal: [],
  picked: null,
  declared: { ...INITIAL_DECLARED },
  round: 0,
  exchanges: [],
  scores: [0, 0],
  runFighter: null,
  runStep: 0,
  beaten: [],
  runOver: null,
};

/** Resting cube angle per real weapon index (0=руки,1=палка,2=нож,3=кистень),
 *  ported from the prototype's `FACE_ROT`. */
const FACE_ROT: [number, number][] = [
  [0, 0],
  [0, -90],
  [0, 180],
  [0, 90],
];

function clock(journalLength: number): string {
  const d = new Date(2026, 10, 14, 14, 42 + journalLength * 3);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function logEntry(state: TournamentPathState, text: string): JournalEntry[] {
  return [{ time: clock(state.journal.length), text }, ...state.journal].slice(0, 4);
}

/** Whether the lot cube can currently be thrown — an allow-list (only
 *  `declare`/`ready`) rather than a block-list, so a new phase added later
 *  is excluded by default instead of silently becoming throwable (the
 *  block-list version of this used to omit "result", letting a player
 *  re-throw after already seeing the outcome). Сходка (runStep 2) never
 *  throws — see `DECLARE_MINE`. Shared by the reducer and `throwLot` below
 *  so the two can't drift apart on what counts as throwable. */
function canThrowLot(state: TournamentPathState): boolean {
  return (state.phase === "declare" || state.phase === "ready") && !!state.runFighter && state.runStep < 2;
}

function bout(state: TournamentPathState) {
  const fighter = state.runFighter;
  const step = fighter ? Math.min(state.runStep, 2) : 0;
  const opponent = fighter ? opponentAt(fighter, step) : buildLadder(null)[step].opponent;
  return {
    a: fighter || "Ваш боец",
    b: opponent,
    label: buildLadder(fighter)[step].label,
  };
}

type Action =
  | { type: "CHOOSE_FIGHTER"; name: string }
  | { type: "RESTART_RUN" }
  | { type: "NEXT_STEP" }
  | { type: "DECLARE"; name: string; weapon: number }
  | { type: "DECLARE_MINE"; weapon: number }
  | { type: "PICK"; name: string }
  | { type: "THROW_LOT_START"; targetRx: number; targetRy: number; weapon: number }
  | { type: "THROW_LOT_SPUN" }
  | { type: "THROW_LOT_RESULT" }
  | { type: "START_BOUT" }
  | { type: "CLASH_START" }
  | { type: "CLASH_RESOLVE" };

function reducer(state: TournamentPathState, action: Action): TournamentPathState {
  switch (action.type) {
    case "CHOOSE_FIGHTER": {
      const ladder = buildLadder(action.name);
      return {
        ...state,
        runFighter: action.name,
        runStep: 0,
        beaten: [],
        runOver: null,
        phase: "declare",
        lot: null,
        round: 0,
        exchanges: [],
        scores: [0, 0],
        picked: action.name,
        journal: logEntry(state, `${action.name} заявлен на турнир. Круг 1: ${ladder[0].opponent}.`),
      };
    }
    case "RESTART_RUN":
      return {
        ...state,
        runFighter: null,
        runStep: 0,
        beaten: [],
        runOver: null,
        phase: "idle",
        lot: null,
        round: 0,
        exchanges: [],
        scores: [0, 0],
        picked: null,
        journal: [],
      };
    case "NEXT_STEP": {
      const nextStep = state.runStep + 1;
      const ladder = state.runFighter ? buildLadder(state.runFighter) : [];
      const next = ladder[nextStep];
      return {
        ...state,
        runStep: nextStep,
        phase: "declare",
        lot: null,
        round: 0,
        exchanges: [],
        scores: [0, 0],
        journal: next ? logEntry(state, `${next.label}: выходит ${next.opponent}.`) : state.journal,
      };
    }
    case "DECLARE":
      return {
        ...state,
        declared: { ...state.declared, [action.name]: action.weapon },
        journal: logEntry(state, `${action.name} заявил разряд: ${weaponLabelLower(action.weapon)}.`),
      };
    case "DECLARE_MINE": {
      if (!state.runFighter) return state;
      const declared = { ...state.declared, [state.runFighter]: action.weapon };
      // Сходка (the final, runStep 2): no жребий — a fighter picks their own
      // разряд outright, so this resolves straight to "result" instead of
      // "ready" (which would still need a cube throw). User decision
      // 2026-09-01: circles 1–2 keep жребий-narrowed-by-declare as before.
      if (state.runStep >= 2) {
        const tally = [...state.tally] as [number, number, number, number];
        tally[action.weapon] += 1;
        return {
          ...state,
          declared,
          phase: "result",
          lot: action.weapon,
          lotCount: state.lotCount + 1,
          tally,
          journal: logEntry(
            state,
            `${state.runFighter} выходит на сходку с разрядом: ${weaponLabelLower(action.weapon)} — без жребия.`,
          ),
        };
      }
      return {
        ...state,
        declared,
        phase: "ready",
        journal: logEntry(state, `${state.runFighter} заявил разряд: ${weaponLabelLower(action.weapon)}.`),
      };
    }
    case "PICK":
      return { ...state, picked: state.picked === action.name ? null : action.name };
    case "THROW_LOT_START": {
      if (!canThrowLot(state)) return state;
      return { ...state, phase: "throw", rx: action.targetRx, ry: action.targetRy, pendingWeapon: action.weapon };
    }
    case "THROW_LOT_SPUN":
      return state.phase === "throw" ? { ...state, phase: "pause" } : state;
    case "THROW_LOT_RESULT": {
      if (state.phase !== "pause" || state.pendingWeapon === null) return state;
      const weapon = state.pendingWeapon;
      const tally = [...state.tally] as [number, number, number, number];
      tally[weapon] += 1;
      const b = bout(state);
      return {
        ...state,
        phase: "result",
        lot: weapon,
        pendingWeapon: null,
        lotCount: state.lotCount + 1,
        tally,
        journal: logEntry(state, `Жребий: ${weaponLabelLower(weapon)} — ${b.label.toLowerCase()}.`),
      };
    }
    case "START_BOUT": {
      const b = bout(state);
      return {
        ...state,
        phase: "bout",
        round: 0,
        exchanges: [],
        scores: [0, 0],
        journal: logEntry(state, `Бойцы сведены: ${b.a} — ${b.b}.`),
      };
    }
    case "CLASH_START":
      return state.phase === "clash" ? state : { ...state, phase: "clash" };
    case "CLASH_RESOLVE": {
      const b = bout(state);
      const last = state.runStep >= 2;
      const win = Math.random() < 0.5 ? 0 : 1;
      const scores = [...state.scores] as [number, number];
      scores[win] += 1;
      const exchanges = [...state.exchanges, win];
      const round = state.round + 1;
      // All 3 соступ are always fought — the winner is whoever took more of
      // the 3, never decided early at 2:0. (User correction 2026-09-01: this
      // demo used to stop as soon as one side reached 2 wins.)
      const done = exchanges.length >= 3;

      let journal = logEntry(
        state,
        `Соступ ${round}: ${roundWinFlavor(state.lot)} — ${win === 0 ? b.a : b.b}.`,
      );

      if (!done) {
        return { ...state, scores, exchanges, round, phase: "bout", journal };
      }

      const iWon = scores[0] > scores[1];
      const beaten = iWon ? [...state.beaten, b.b] : state.beaten;
      const runOver: TournamentPathState["runOver"] = iWon ? (last ? "champion" : null) : "out";

      journal = [
        {
          time: clock(state.journal.length + 1),
          text: `${b.label} окончен, счёт ${scores[0]}:${scores[1]} — ${
            iWon ? `дальше идёт ${b.a}` : `${b.a} выбывает`
          }.`,
        },
        ...journal,
      ].slice(0, 4);
      if (runOver === "champion") {
        journal = [
          { time: clock(state.journal.length + 2), text: `Сходка взята. ${b.a} — победитель турнира.` },
          ...journal,
        ].slice(0, 4);
      }

      return { ...state, scores, exchanges, round, phase: "over", beaten, runOver, journal };
    }
    default:
      return state;
  }
}

// A fourth hardcoded copy of the weapon labels used to live here (still
// saying "голыми руками" after `WEAPON_LABELS` itself had already been
// corrected to "Безоружный") — read from `WEAPON_LABELS` instead so there's
// exactly one source of truth for this text, not four that can drift apart.
function weaponLabelLower(index: number): string {
  return WEAPON_LABELS[index]?.label.toLowerCase() ?? "";
}

/**
 * Flavor text for a resolved соступ (round) — this demo already treats
 * every resolved соступ as deciding that round outright (no in-round
 * point accumulation, per its own "Наглядно" abstraction), which happens to
 * line up with [[tournament-domain-rules]]'s real scoring: an expressive
 * head/neck strike (stick or knife) IS worth a clean round win by itself,
 * unlike a lesser limb/body hit — so "чистый удар в голову" for стick/knife
 * isn't invented, it's the one real outcome type this flat abstraction can
 * honestly claim every time. Keyed by `WEAPON_LABELS` index; kistenʹ has no
 * real-source rules ([[tournament-domain-rules]] flags this explicitly), so
 * its flavor stays weapon-neutral rather than guessing at technique.
 */
const ROUND_WIN_FLAVORS: [string[], string[], string[], string[]] = [
  ["бросок и удержание", "залом на удержании", "уход с обезоруживанием"],
  ["чистый удар в голову", "чистый удар в голову — встречен жёстко", "снаряд выбит, ход взят"],
  ["чистый порез в открытую линию", "укол в шею — чисто", "экспрессивный удар в корпус, засчитан"],
  ["точное попадание грузом", "дистанция потеряна, удар пришёлся", "обхват перехвачен, снаряд взят"],
];

function roundWinFlavor(lot: number | null): string {
  const pool = ROUND_WIN_FLAVORS[lot ?? 0] ?? ROUND_WIN_FLAVORS[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

type TournamentPathActions = {
  chooseFighter: (name: string) => void;
  restartRun: () => void;
  nextStep: () => void;
  declare: (name: string, weapon: number) => void;
  declareMine: (weapon: number) => void;
  pick: (name: string) => void;
  throwLot: () => void;
  /** Called by `LotCube` off the cube's own `transitionend` — see
   *  `throwLot`'s doc comment for why this replaced a parallel timer. */
  confirmSpin: () => void;
  startBout: () => void;
  runRound: () => void;
  /** Scales every timed transition's on-screen duration (0.6–1.6, default 1)
   *  — components with their own CSS `transition`/`animation` duration (the
   *  lot cube's spin, the clash `impact`/`lunge`) divide by this so the
   *  visual motion matches when the context's own timers actually resolve. */
  ritualSpeed: number;
};

const StateContext = createContext<TournamentPathState | null>(null);
const ActionsContext = createContext<TournamentPathActions | null>(null);

/** `ritualSpeed` (0.6–1.6) scales every timed transition below — matches the
 *  handoff's own `ritualSpeed` prop; timers here use `duration / ritualSpeed`
 *  so a higher speed shortens the wait. Defaults to 1 (no scaling). */
export function TournamentPathProvider({
  children,
  ritualSpeed = 1,
}: {
  children: ReactNode;
  ritualSpeed?: number;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
    };
  }, []);

  const throwLot = useCallback(() => {
    // "declare" is deliberately throwable, not just "ready": declaring a
    // category (the small icons in `lot-cube.tsx`) is an optional way to
    // narrow the жребий to your own guess, never a prerequisite — offline,
    // a fighter can just throw the cube straight away. `pool` below already
    // falls back to a fully random weapon when nobody has declared.
    if (!canThrowLot(state)) return;
    const b = bout(state);
    const pool = [state.declared[b.a], state.declared[b.b]].filter((x) => x !== undefined);
    const weapon = pool.length ? pool[Math.floor(Math.random() * pool.length)] : Math.floor(Math.random() * 4);
    const base = FACE_ROT[weapon];
    const targetRx = base[0] + 360 * 2 + Math.round(state.rx / 360) * 360;
    const targetRy = base[1] + 360 * 3 + Math.round(state.ry / 360) * 360;
    // No timer scheduling "spun" here anymore — a `setTimeout` matched to the
    // CSS transition's own duration can drift from when the cube actually
    // finishes turning (main-thread jank, a slow device), which is exactly
    // the "result already showing while the cube still visibly spins" bug
    // reported 2026-09-01. `LotCube` calls `confirmSpin()` off the real
    // `transitionend` event instead, so "spun" fires when the cube truly is.
    dispatch({ type: "THROW_LOT_START", targetRx, targetRy, weapon });
  }, [state]);

  // Fired by `LotCube`'s `onTransitionEnd` once the cube's own CSS rotation
  // genuinely finishes — see `throwLot`'s comment above for why this isn't a
  // timer anymore.
  const confirmSpin = useCallback(() => {
    dispatch({ type: "THROW_LOT_SPUN" });
  }, []);

  // The dramatic beat between the cube settling and the result revealing —
  // unlike the spin above, this one has no independent visual to drift out
  // of sync with, so a timer is fine; it only starts once "pause" is
  // actually entered (via `confirmSpin`, real event-driven), not in
  // parallel with the spin itself.
  useEffect(() => {
    if (state.phase !== "pause") return;
    const id = setTimeout(() => dispatch({ type: "THROW_LOT_RESULT" }), 320 / ritualSpeed);
    return () => clearTimeout(id);
  }, [state.phase, ritualSpeed]);

  const runRound = useCallback(() => {
    if (state.phase === "clash") return;
    dispatch({ type: "CLASH_START" });
    schedule(() => dispatch({ type: "CLASH_RESOLVE" }), 760 / ritualSpeed);
  }, [state.phase, ritualSpeed, schedule]);

  const actions = useMemo<TournamentPathActions>(
    () => ({
      chooseFighter: (name) => dispatch({ type: "CHOOSE_FIGHTER", name }),
      restartRun: () => dispatch({ type: "RESTART_RUN" }),
      nextStep: () => dispatch({ type: "NEXT_STEP" }),
      declare: (name, weapon) => dispatch({ type: "DECLARE", name, weapon }),
      declareMine: (weapon) => dispatch({ type: "DECLARE_MINE", weapon }),
      pick: (name) => dispatch({ type: "PICK", name }),
      throwLot,
      confirmSpin,
      startBout: () => dispatch({ type: "START_BOUT" }),
      runRound,
      ritualSpeed,
    }),
    [throwLot, confirmSpin, runRound, ritualSpeed],
  );

  return (
    <StateContext.Provider value={state}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </StateContext.Provider>
  );
}

export function useTournamentPathState(): TournamentPathState {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error("useTournamentPathState must be used within a TournamentPathProvider");
  return ctx;
}

export function useTournamentPathActions(): TournamentPathActions {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error("useTournamentPathActions must be used within a TournamentPathProvider");
  return ctx;
}

export function useCurrentBout() {
  const state = useTournamentPathState();
  return bout(state);
}

export { canThrowLot, pairIndexOf };
