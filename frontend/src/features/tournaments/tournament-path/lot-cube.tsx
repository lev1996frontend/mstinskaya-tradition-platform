"use client";

import { HandsIcon, KistenIcon, KrugIcon, NozhIcon, PalkaIcon, StenkaIcon } from "@/components/brand/weapon-glyphs";
import { cubeThrowCss } from "@/lib/motion";
import { canThrowLot, useTournamentPathActions, useTournamentPathState } from "./tournament-path-context";
import { CUBE_FACE_KEYS, WEAPON_LABELS } from "./bracket-data";

const FACE_ICONS = {
  hands: HandsIcon,
  palka: PalkaIcon,
  nozh: NozhIcon,
  kisten: KistenIcon,
  krug: KrugIcon,
  stenka: StenkaIcon,
} as const;

/** Cube geometry: 6 faces of a 132px box, each translated out of the box
 *  center then rotated to its resting side — the standard 3D-cube recipe,
 *  ordered to match `CUBE_FACE_KEYS` (hands/palka/nozh/kisten/krug/stenka). */
const FACE_TRANSFORMS = [
  "translateZ(66px)",
  "rotateY(90deg) translateZ(66px)",
  "rotateY(180deg) translateZ(66px)",
  "rotateY(-90deg) translateZ(66px)",
  "rotateX(90deg) translateZ(66px)",
  "rotateX(-90deg) translateZ(66px)",
];

const PHASE_HINT: Partial<Record<string, string>> = {
  idle: "Выберите бойца",
  // Spells out both paths — throw straight away, or narrow the жребий by
  // declaring below first — since a first-time visitor otherwise has no cue
  // that the icon row underneath does anything. "ready" already has its
  // declare done, so it drops back to the single remaining action.
  declare: "Нажмите на плиту — бросьте жребий, или выберите разряд вручную ниже",
  ready: "Готов к жребию — нажмите на плиту",
  result: "Разряд определён",
  bout: "Идёт бой",
  clash: "Сшибка",
  over: "Результат",
};

export function LotCube() {
  const state = useTournamentPathState();
  const { throwLot, confirmSpin, declareMine, ritualSpeed } = useTournamentPathActions();
  const spinMs = 1150 / ritualSpeed;
  // Сходка (runStep 2): a fighter picks their own разряд outright, no
  // жребий — `declareMine` resolves straight to "result" for it (see
  // `tournament-path-context.tsx`), so the cube's own hint would be wrong.
  const isFinal = state.runStep >= 2;
  const hint = isFinal && state.phase === "declare" ? "Финал без жребия — выберите разряд сами" : PHASE_HINT[state.phase] ?? "";

  // Сходка: no жребий at all — swap the cube stage for the same weapon-pick
  // row used elsewhere as an optional narrowing, now the *only* control and
  // sized up accordingly, rather than leaving a cube that would still throw
  // (misleadingly, since the copy around it now says "без жребия").
  const showCube = !(isFinal && state.phase === "declare");
  // Once a throw has landed (or any later phase), the plate stops
  // responding — otherwise clicking it again silently re-rolls the already
  // revealed разряд, letting a player keep re-throwing until they get the
  // weapon they want.
  const throwable = canThrowLot(state);

  return (
    <div className="grid place-items-center gap-[22px]">
      {showCube ? (
        <div
          className={`lot-cube-stage relative grid place-items-center ${state.phase === "throw" ? "cam" : ""}`}
          style={{ width: 300, height: 300, perspective: 900 }}
        >
          <span
            aria-hidden="true"
            className="absolute rounded-full border border-[var(--border)]"
            style={{ width: 290, height: 290 }}
          />
          <span
            aria-hidden="true"
            className="absolute rounded-full border border-dashed border-[var(--border)]"
            style={{ width: 214, height: 214 }}
          />
          <span
            aria-hidden="true"
            className="absolute rounded-full bg-black/75 blur-[11px] transition-opacity duration-500"
            style={{ width: 168, height: 26, bottom: 34, opacity: state.phase === "throw" ? 0.35 : 1 }}
          />
          {state.phase === "clash" ? (
            <span
              aria-hidden="true"
              className="dust absolute rounded-full"
              style={{
                width: 240,
                height: 42,
                bottom: 26,
                background: "radial-gradient(closest-side, rgba(176,122,53,.5), transparent)",
                filter: "blur(9px)",
                animationDuration: `${900 / ritualSpeed}ms`,
              }}
            />
          ) : null}
          <button
            type="button"
            onClick={throwLot}
            // `aria-disabled` + `pointer-events-none` below, not the native
            // `disabled` attribute: disabling a button whose children carry
            // `transform-style: preserve-3d` collapses every face's own
            // rotated box to zero width in Chromium, i.e. the whole cube
            // silently vanishes the moment it stops being throwable.
            aria-disabled={!throwable}
            onTransitionEnd={(event) => {
              // The result used to reveal off a `setTimeout` matched to
              // `spinMs` — close enough in a quick check, but a timer can
              // drift from when the cube's own CSS rotation genuinely
              // finishes painting (main-thread jank, a slow device), which
              // read as "the result already showing while the cube's still
              // visibly spinning". Firing off the real `transitionend`
              // instead ties it to what's actually on screen.
              if (event.propertyName !== "transform" || state.phase !== "throw") return;
              confirmSpin();
            }}
            aria-label="Бросить жребий"
            className={`relative border-none bg-transparent p-0 ${throwable ? "cursor-pointer" : "pointer-events-none cursor-default opacity-60"}`}
            style={{
              width: 132,
              height: 132,
              transformStyle: "preserve-3d",
              transition: `${cubeThrowCss(spinMs)}, opacity 300ms ease`,
              transform: `rotateX(${state.rx}deg) rotateY(${state.ry}deg)`,
            }}
          >
            {CUBE_FACE_KEYS.map((key, i) => {
              const Icon = FACE_ICONS[key];
              const isOutcome = state.phase === "result" && state.lot === i;
              return (
                <span
                  key={key}
                  className="absolute inset-0 grid place-items-center border shadow-[inset_0_0_34px_rgba(0,0,0,.6)]"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--iron)",
                    color: isOutcome ? "var(--accent)" : "var(--iron)",
                    transform: FACE_TRANSFORMS[i],
                  }}
                >
                  <Icon size={54} />
                </span>
              );
            })}
          </button>
        </div>
      ) : null}

      <span className="record-label text-[var(--text-4)]">{hint}</span>

      {state.phase === "declare" && state.runFighter ? (
        <div className="flex flex-col items-center gap-2.5">
          <span className="record-label text-[var(--gold)]">{isFinal ? "Выберите разряд" : "Заявите свой разряд"}</span>
          <span className="flex gap-2">
            {WEAPON_LABELS.map(({ key, label }, i) => {
              const Icon = FACE_ICONS[key];
              const active = state.declared[state.runFighter!] === i;
              return (
                <button
                  key={key}
                  type="button"
                  title={label}
                  onClick={() => declareMine(i)}
                  className="grid cursor-pointer place-items-center border transition-colors"
                  style={{
                    width: isFinal ? 52 : 40,
                    height: isFinal ? 52 : 40,
                    background: active ? "var(--surface-muted)" : "transparent",
                    borderColor: active ? "var(--accent)" : "var(--border-strong)",
                    color: active ? "var(--accent)" : "var(--text-4)",
                  }}
                >
                  <Icon size={isFinal ? 26 : 21} />
                </button>
              );
            })}
          </span>
        </div>
      ) : null}
    </div>
  );
}
