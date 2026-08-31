import type { WeaponMotifKey } from "@/components/brand/weapon-glyphs";

/**
 * Demo data for the ПОЕДИНОК/СЕТКА homepage walkthrough — ported verbatim
 * (names, clubs, pairing structure) from the design_handoff_mstinskaya v3
 * prototype. Deliberately not backend-sourced: this is a single frontend-only
 * narrative device (a visitor plays one fixed 8-person bracket as one
 * fighter), confirmed with the product owner as staying a labelled demo
 * rather than wired to a real competition — see `poedinok.tsx`'s disclaimer
 * and `weapon-draw-billet.tsx` for the established "illustrative" precedent.
 *
 * ПОЕДИНОК (the fight walkthrough) and СЕТКА (the bracket grid) both read
 * from this one module so they can never disagree about who is fighting whom
 * — the whole reason this file exists separately from either component.
 */

export const WEAPON_LABELS: { key: WeaponMotifKey; label: string }[] = [
  { key: "hands", label: "Голыми руками" },
  { key: "palka", label: "Палка" },
  { key: "nozh", label: "Нож" },
  { key: "kisten", label: "Кистень" },
];

export type CubeFaceKey = WeaponMotifKey | "krug" | "stenka";

/** Cube face order: the 4 real categories plus 2 decorative-only faces
 *  (`krug`/`stenka`) that fill out a 6-sided die visually but can never be
 *  the outcome of a throw — see `throwLot` in `tournament-path-context.tsx`,
 *  which only ever picks index 0–3. */
export const CUBE_FACE_KEYS: CubeFaceKey[] = ["hands", "palka", "nozh", "kisten", "krug", "stenka"];

export const LADDER_LABELS = ["Круг 1", "Полуфинал", "Сходка"] as const;

export const RUN_FIGHTERS = [
  { name: "А. Ветров", club: "Мста · Вышний Волочёк" },
  { name: "И. Дорохов", club: "Буза · Тверь" },
  { name: "М. Гуляев", club: "Мста · Боровичи" },
] as const;

export const PAIRS: [string, string][] = [
  ["А. Ветров", "Д. Ершов"],
  ["С. Кузьмин", "Т. Савин"],
  ["И. Дорохов", "Р. Белов"],
  ["М. Гуляев", "П. Лавров"],
];

export const CLUBS: Record<string, string> = {
  "А. Ветров": "Мста · Вышний Волочёк",
  "Д. Ершов": "Буза · Тверь",
  "С. Кузьмин": "Порубежье · Торжок",
  "Т. Савин": "Застава · Удомля",
  "И. Дорохов": "Буза · Тверь",
  "Р. Белов": "Мста · Боровичи",
  "М. Гуляев": "Мста · Боровичи",
  "П. Лавров": "Застава · Удомля",
};

/** Winners of the half of the bracket the visitor's fighter isn't in — fixed
 *  so that half never "drifts" as the visitor plays through their own half. */
export const GHOST_R1 = ["Д. Ершов", "С. Кузьмин", "Р. Белов", "П. Лавров"];
export const GHOST_R2 = ["С. Кузьмин", "П. Лавров"];

export const INITIAL_DECLARED: Record<string, number> = {
  "А. Ветров": 1,
  "С. Кузьмин": 0,
  "И. Дорохов": 2,
  "М. Гуляев": 3,
  "Д. Ершов": 0,
  "Т. Савин": 1,
  "Р. Белов": 2,
  "П. Лавров": 3,
};

/** Which pair (0–3) a fighter's first-round slot belongs to. */
export function pairIndexOf(fighter: string): number {
  const index = PAIRS.findIndex((pair) => pair.includes(fighter));
  return index >= 0 ? index : 0;
}

/** The opponent standing at ladder step `step` (0 = круг 1, 1 = полуфинал,
 *  2 = сходка), derived from the fixed pairing/ghost data — never stored as
 *  its own piece of state, so it can't fall out of sync with the bracket. */
export function opponentAt(fighter: string, step: number): string {
  const p = pairIndexOf(fighter);
  if (step === 0) {
    const [a, b] = PAIRS[p];
    return a === fighter ? b : a;
  }
  if (step === 1) return GHOST_R1[p ^ 1];
  return GHOST_R2[p < 2 ? 1 : 0];
}

export type LadderStep = { label: string; opponent: string; club: string };

/** The three-step ladder header — opponent per step is real (derived from
 *  `opponentAt`) once a fighter is picked, or an inert preview otherwise. */
export function buildLadder(fighter: string | null): LadderStep[] {
  return LADDER_LABELS.map((label, i) => {
    const opponent = fighter ? opponentAt(fighter, i) : [GHOST_R1[0], GHOST_R1[1], GHOST_R2[0]][i];
    return { label, opponent, club: CLUBS[opponent] ?? "" };
  });
}

export type BracketCell = { name: string; club: string };
export type BracketColumn = { label: string; cells: BracketCell[] };

/** The 4-column 8→4→2→1 bracket, built from the same `PAIRS`/`GHOST_*`
 *  source `buildLadder` uses. `runStep`/`runOver` decide whether the
 *  visitor's own slot shows their name or "—" (not yet reached). */
export function buildBracket(
  fighter: string | null,
  runStep: number,
  runOver: "out" | "champion" | null,
): BracketColumn[] {
  const p = fighter ? pairIndexOf(fighter) : -1;
  const myHalf = p < 2 ? 0 : 1;
  const wonStep = (step: number) =>
    !!fighter && (step < runStep || (step === runStep && runOver !== null && runOver !== "out"));

  const col1 = PAIRS.flatMap((pair) => pair);
  const col2 = PAIRS.map((pair, i) => (i === p && fighter ? (wonStep(0) ? fighter : "—") : GHOST_R1[i]));
  const col3 = [0, 1].map((half) => (half === myHalf && fighter ? (wonStep(1) ? fighter : "—") : GHOST_R2[half]));
  const col4 = [runOver === "champion" && fighter ? fighter : "—"];

  const cell = (name: string): BracketCell => ({
    name,
    club: name === "—" ? "ожидает" : (CLUBS[name] ?? ""),
  });

  return [
    { label: "Круг 1 · 8 бойцов", cells: col1.map(cell) },
    { label: "Полуфинал · 4 бойца", cells: col2.map(cell) },
    { label: "Сходка · 2 бойца", cells: col3.map(cell) },
    { label: "Победитель", cells: col4.map(cell) },
  ];
}
