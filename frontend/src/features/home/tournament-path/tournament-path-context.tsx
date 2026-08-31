"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import type { ReactNode } from "react";

import { buildLadder, INITIAL_DECLARED, opponentAt, pairIndexOf } from "./bracket-data";

export type Phase = "idle" | "declare" | "ready" | "throw" | "pause" | "result" | "bout" | "clash" | "over";

export type JournalEntry = { time: string; text: string };

export type TournamentPathState = {
  phase: Phase;
  rx: number;
  ry: number;
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
  | { type: "THROW_LOT_START"; targetRx: number; targetRy: number }
  | { type: "THROW_LOT_SPUN" }
  | { type: "THROW_LOT_RESULT"; weapon: number }
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
      return {
        ...state,
        declared: { ...state.declared, [state.runFighter]: action.weapon },
        phase: "ready",
        journal: logEntry(state, `${state.runFighter} заявил разряд: ${weaponLabelLower(action.weapon)}.`),
      };
    }
    case "PICK":
      return { ...state, picked: state.picked === action.name ? null : action.name };
    case "THROW_LOT_START": {
      if (
        ["throw", "pause", "declare", "idle", "bout", "clash", "over"].includes(state.phase) ||
        !state.runFighter
      ) {
        return state;
      }
      return { ...state, phase: "throw", rx: action.targetRx, ry: action.targetRy };
    }
    case "THROW_LOT_SPUN":
      return state.phase === "throw" ? { ...state, phase: "pause" } : state;
    case "THROW_LOT_RESULT": {
      if (state.phase !== "pause") return state;
      const tally = [...state.tally] as [number, number, number, number];
      tally[action.weapon] += 1;
      const b = bout(state);
      return {
        ...state,
        phase: "result",
        lot: action.weapon,
        lotCount: state.lotCount + 1,
        tally,
        journal: logEntry(state, `Жребий: ${weaponLabelLower(action.weapon)} — ${b.label.toLowerCase()}.`),
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
      const done = exchanges.length >= 3 || scores[win] === 2;

      let journal = logEntry(state, `Обмен ${round}: чистое касание — ${win === 0 ? b.a : b.b}.`);

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

function weaponLabelLower(index: number): string {
  return ["голыми руками", "палка", "нож", "кистень"][index]?.toLowerCase() ?? "";
}

type TournamentPathActions = {
  chooseFighter: (name: string) => void;
  restartRun: () => void;
  nextStep: () => void;
  declare: (name: string, weapon: number) => void;
  declareMine: (weapon: number) => void;
  pick: (name: string) => void;
  throwLot: () => void;
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
    if (
      ["throw", "pause", "declare", "idle", "bout", "clash", "over"].includes(state.phase) ||
      !state.runFighter
    ) {
      return;
    }
    const b = bout(state);
    const pool = [state.declared[b.a], state.declared[b.b]].filter((x) => x !== undefined);
    const weapon = pool.length ? pool[Math.floor(Math.random() * pool.length)] : Math.floor(Math.random() * 4);
    const spinMs = 1150 / ritualSpeed;
    const base = FACE_ROT[weapon];
    const targetRx = base[0] + 360 * 2 + Math.round(state.rx / 360) * 360;
    const targetRy = base[1] + 360 * 3 + Math.round(state.ry / 360) * 360;
    dispatch({ type: "THROW_LOT_START", targetRx, targetRy });
    schedule(() => dispatch({ type: "THROW_LOT_SPUN" }), spinMs);
    schedule(() => dispatch({ type: "THROW_LOT_RESULT", weapon }), spinMs + 320 / ritualSpeed);
  }, [state, ritualSpeed, schedule]);

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
      startBout: () => dispatch({ type: "START_BOUT" }),
      runRound,
      ritualSpeed,
    }),
    [throwLot, runRound, ritualSpeed],
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

export { pairIndexOf };
