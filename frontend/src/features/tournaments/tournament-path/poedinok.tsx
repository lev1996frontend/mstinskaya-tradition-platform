"use client";

import { Badge } from "@/components/ui";
import { CLUBS, RUN_FIGHTERS, WEAPON_LABELS, buildLadder } from "./bracket-data";
import { FighterCard } from "./fighter-card";
import { JournalPanel } from "./journal-panel";
import { LotCube } from "./lot-cube";
import type { Phase } from "./tournament-path-context";
import { useCurrentBout, useTournamentPathActions, useTournamentPathState } from "./tournament-path-context";

const PHASE_LABEL: Record<Phase, [string, string]> = {
  idle: ["Выберите бойца", "var(--text-4)"],
  declare: ["Заявка разряда", "var(--gold)"],
  ready: ["Готов к жребию", "var(--gold)"],
  throw: ["Бросок", "var(--accent)"],
  pause: ["Пауза", "var(--text-4)"],
  result: ["Разряд определён", "var(--gold)"],
  bout: ["Идёт соступ", "var(--accent)"],
  clash: ["Сшибка", "var(--accent)"],
  over: ["Результат", "var(--gold)"],
};

const WEAPON_DESCRIPTIONS = [
  "Захват, выведение из равновесия и работа на отходе. Разряд, с которого начинают все.",
  "Дистанция и линия: самый техничный разряд, счёт идёт по чистым касаниям.",
  "Мягкий макет и короткая дистанция — цена ошибки максимальная.",
  "Гибкий снаряд с грузом: темп задаёт кисть, защита строится на разрыве дистанции.",
];

/**
 * The interactive centerpiece of `/tournaments` — play a fixed 8-person demo
 * bracket as one fighter. Confirmed product decision: this stays a
 * frontend-only illustration, not wired to the real tournament backend
 * (which has no "declare a category before the draw" or "clash" concept —
 * see `bracket-data.ts`'s header comment). Same "Наглядно" labelling
 * precedent as `features/tournaments/weapon-draw-billet.tsx`.
 */
export function Poedinok() {
  const state = useTournamentPathState();
  const actions = useTournamentPathActions();
  const bout = useCurrentBout();
  const ladder = buildLadder(state.runFighter);
  const ph = state.phase;
  const fighting = ph === "bout" || ph === "clash" || ph === "over";
  const winner = ph === "over" ? (state.scores[0] > state.scores[1] ? 0 : 1) : null;
  const [phaseLabel, phaseTone] = PHASE_LABEL[ph];
  const clashing = ph === "clash";

  const runTitle = !state.runFighter
    ? "Пройдите турнир за одного бойца"
    : state.runOver === "champion"
      ? "Сходка взята"
      : state.runOver === "out"
        ? `${bout.a} выбывает`
        : ph === "over"
          ? `${bout.label} взят`
          : `${bout.label} · ${bout.a} против ${bout.b}`;

  const runIntro = !state.runFighter
    ? "Три круга подряд: круг 1, полуфинал, сходка. Разряд заявляете сами, но снаряд выбирает жребий из двух заявленных. Одно поражение — и путь закончен."
    : state.runOver === "champion"
      ? `Пройдены все три круга: ${state.beaten.join(", ")}. Путь можно начать заново за другого бойца.`
      : state.runOver === "out"
        ? `Пройдено кругов: ${state.beaten.length} из 3. В традиции второго шанса в сетке нет — только следующий турнир.`
        : ph === "over"
          ? `${bout.b} пройден со счётом ${state.scores[0]}:${state.scores[1]}. Осталось кругов: ${2 - state.runStep}.`
          : "Заявите разряд, бросьте жребий и проведите соступы. Победа — до двух чистых касаний.";

  const lot = state.lot;
  const lotTitle =
    ph === "idle" || ph === "declare"
      ? ph === "declare"
        ? "С чем выходите"
        : "Круг ждёт"
      : ph === "over"
        ? state.runOver === "out"
          ? "Путь закончен"
          : `Дальше идёт ${winner === 0 ? bout.a : bout.b}`
        : ph === "bout" || ph === "clash"
          ? `Соступ ${state.round + 1} из 3`
          : lot === null || ph !== "result"
            ? "Разряд решает жребий"
            : WEAPON_LABELS[lot].label;

  const lotText =
    ph === "idle"
      ? "Выберите бойца выше — и круг соберётся."
      : ph === "declare"
        ? state.runStep >= 2
          ? "Сходка — разряд на неё выбираете сами, без жребия: любой из четырёх."
          : "Заявите разряд, если хотите сузить жребий до своей заявки, или сразу бросьте плиту: удобного снаряда всё равно не бывает."
        : ph === "over"
          ? `Счёт ${state.scores[0]}:${state.scores[1]}. Результат уходит в журнал и в сетку: пройденные противники отмечаются красным.`
          : ph === "bout" || ph === "clash"
            ? "Бой идёт до двух чистых касаний, максимум три соступа. Судейская тройка держит счёт: сшибка, остановка, разбор — и снова в круг."
            : lot === null || ph !== "result"
              ? "Разряды заявлены. Бросьте плиту: жребий выберет снаряд из двух заявленных."
              : WEAPON_DESCRIPTIONS[lot];

  const primaryLabel =
    ph === "idle"
      ? "Выберите бойца"
      : ph === "result"
          ? "Свести бойцов"
          : ph === "over"
            ? state.runOver
              ? "Начать путь заново"
              : "Следующий круг →"
            : ph === "bout"
              ? `Сшибка ${state.round + 1} →`
              : ph === "clash"
                ? "Сшибка…"
                : "Бросить жребий";

  const primaryAction =
    ph === "result"
      ? actions.startBout
      : ph === "over"
        ? state.runOver
          ? actions.restartRun
          : actions.nextStep
        : ph === "bout" || ph === "clash"
          ? actions.runRound
          : actions.throwLot;

  const fightRounds = [0, 1, 2].map((i) => {
    const res = state.exchanges[i];
    return { label: res === undefined ? String(i + 1) : res === 0 ? "A" : "Б", decided: res !== undefined };
  });

  return (
    <section id="poedinok" className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--background-deep)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(70% 60% at 50% 40%, rgba(142,36,29,.14), transparent 70%)" }}
      />
      {clashing ? (
        <div
          aria-hidden="true"
          className="flash pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(50% 40% at 50% 45%, rgba(176,42,32,.55), transparent 70%)" }}
        />
      ) : null}

      <div className="relative mx-auto w-full max-w-[88rem] px-6 py-20 sm:px-10 sm:py-24">
        <div className="flex items-center gap-5">
          <span className="record-label text-[var(--gold)]">Поединок · {bout.label}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-[var(--border)]" />
          <Badge>Наглядно</Badge>
          <span className="record-label" style={{ color: phaseTone }}>
            {phaseLabel}
          </span>
        </div>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-3)]">
          Это демонстрация одного пути по турнирной сетке, не настоящий поединок. Настоящий жребий
          бросается в карточке боя судьёй и сразу пишется сервером в журнал — см. настоящий список
          турниров на этой странице.
        </p>

        <div className="mt-9 grid grid-cols-1 items-end gap-12 border-b border-[var(--border)] pb-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
          <div>
            <h2 className="font-display m-0 text-[2.5rem] font-bold leading-[1.04] tracking-tight">{runTitle}</h2>
            <p className="mt-3.5 max-w-lg text-base leading-relaxed text-[var(--text-3)]">{runIntro}</p>
            {!state.runFighter ? (
              /* One column of equal cards on a phone, a flowing row once there
                 is width for one. As a `flex-wrap` row at every size each
                 button took the width of the name inside it, so on a narrow
                 screen they stacked into a ragged staircase — three cards of
                 three different widths reads as a layout that broke, not as a
                 list. */
              <div className="mt-6 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
                {RUN_FIGHTERS.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => actions.chooseFighter(f.name)}
                    className="flex flex-col items-start gap-1.5 border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface)]"
                  >
                    <span className="font-display text-[1.375rem] font-bold text-[var(--foreground)]">{f.name}</span>
                    <span className="record-label text-[var(--text-4)]">{f.club}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)]">
            {ladder.map((step, i) => {
              const done = i < state.runStep || (i === state.runStep && ph === "over" && state.runOver !== "out");
              const lost = i === state.runStep && state.runOver === "out";
              const now = i === state.runStep && !state.runOver;
              const stateLabel = !state.runFighter ? "ожидает" : done ? "пройден" : lost ? "проигран" : now ? "идёт" : "впереди";
              const tone = done ? "var(--gold)" : lost ? "var(--accent)" : now ? "var(--foreground)" : "var(--text-4)";
              const bar = done ? "var(--gold)" : lost ? "var(--accent)" : now ? "var(--accent)" : "var(--border-strong)";
              return (
                <span key={step.label} className="flex flex-col gap-2.5 px-3.5 py-4" style={{ background: now ? "var(--surface)" : "var(--surface-muted)" }}>
                  <span className="record-label text-[var(--text-4)]">{step.label}</span>
                  <span className="record-label" style={{ color: tone }}>
                    {stateLabel}
                  </span>
                  <span className="h-0.5" style={{ background: bar }} />
                </span>
              );
            })}
          </div>
        </div>

        {/* `perspective` sits here, on the row both fighter cards and the lot
            cube share, rather than on each card individually — one vanishing
            point at the row's center, so the two tilted cards read as facing
            each other/the cube instead of each tilting in its own isolated
            3D space. */}
        <div
          className="mt-11 grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)_minmax(0,1fr)]"
          style={{ perspective: 1400 }}
        >
          <FighterCard
            side="left"
            name={bout.a}
            club={state.runFighter ? (RUN_FIGHTERS.find((f) => f.name === state.runFighter)?.club ?? "") : "выберите бойца"}
            score={fighting ? state.scores[0] : null}
            isWinner={winner === 0}
            declaredWeapon={state.declared[bout.a]}
            clashing={clashing}
          />

          <LotCube />

          <FighterCard
            side="right"
            name={bout.b}
            club={CLUBS[bout.b] ?? ""}
            score={fighting ? state.scores[1] : null}
            isWinner={winner === 1}
            declaredWeapon={state.declared[bout.b]}
            clashing={clashing}
          />
        </div>

        <div className="mt-14 grid grid-cols-1 items-start gap-14 border-t border-[var(--border)] pt-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <h2 className="font-display m-0 text-[2.75rem] font-bold leading-[1.02] tracking-tight" style={{ color: ph === "over" || ph === "clash" ? "var(--accent)" : "var(--foreground)" }}>
              {lotTitle}
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--text-3)]">{lotText}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {/* Сходка's "declare" phase has no жребий to throw — the weapon
                  icons above (in `LotCube`) are the only control, so this
                  button (which would otherwise still say/do "Бросить
                  жребий" for nothing) is suppressed rather than left as a
                  dead end. */}
              {ph === "declare" && state.runStep >= 2 ? null : (
                <button
                  type="button"
                  onClick={primaryAction}
                  className="btn-primary relative font-record bg-[var(--accent)] px-7 py-4 text-[0.75rem] uppercase tracking-[0.16em] text-[var(--background)] transition-[transform,filter] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-px hover:scale-[1.012] hover:brightness-110 active:translate-y-0.5 active:scale-[.985]"
                >
                  <span aria-hidden="true" className="btn-stamp-ring" />
                  {primaryLabel}
                </button>
              )}
              <span className="record-label text-[var(--text-4)]">Броски: {String(state.lotCount).padStart(2, "0")}</span>
              <span className="flex items-center gap-2">
                {fightRounds.map((round, i) => (
                  <span
                    key={i}
                    className="font-record grid size-[30px] place-items-center border text-[0.625rem]"
                    style={{
                      borderColor: round.decided ? "var(--accent-deep)" : "var(--border)",
                      background: round.decided ? "var(--surface)" : "transparent",
                      color: round.decided ? "var(--accent)" : "var(--text-4)",
                    }}
                  >
                    {round.label}
                  </span>
                ))}
              </span>
            </div>
          </div>

          <JournalPanel />
        </div>
      </div>
    </section>
  );
}
