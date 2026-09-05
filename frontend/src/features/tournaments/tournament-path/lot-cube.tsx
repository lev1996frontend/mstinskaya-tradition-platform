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
  declare: "Нажмите на куб — бросьте жребий, или выберите разряд вручную ниже",
  ready: "Готов к жребию — нажмите на куб",
  result: "Разряд определён",
  bout: "Идёт соступ",
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
  // Once a throw has landed (or any later phase), the cube stops
  // responding — otherwise clicking it again silently re-rolls the already
  // revealed разряд, letting a player keep re-throwing until they get the
  // weapon they want.
  const throwable = canThrowLot(state);

  return (
    <div className="grid place-items-center gap-[22px]">
      {showCube ? (
        // The narrow-phone scale lives on this wrapper, never on the stage
        // itself: the stage carries the perspective the cube's faces stand out
        // in, and giving that element its own `transform` flattens them into a
        // plate. See `.lot-cube-scale` in globals.css.
        <div className="lot-cube-scale">
        {/* The camera shake sits on its own wrapper, not on the stage. `.cam`
            animates a `transform`, and the stage is the element carrying
            `perspective`: a transformed element whose `transform-style` is the
            default `flat` flattens its own 3D children, so for the whole
            length of every throw the cube was rendering as a single plate —
            exactly the beat where it most needs to read as a tumbling cube.
            An ancestor may be transformed freely; the same reason the
            narrow-phone scale lives on `.lot-cube-scale` above. */}
        <div className={state.phase === "throw" ? "cam" : undefined}>
        <div
          className="lot-cube-stage relative grid place-items-center"
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
              // `event.target === currentTarget`: the faces run their own
              // opacity transition, and those events bubble up to this button.
              if (event.target !== event.currentTarget) return;
              if (event.propertyName !== "transform" || state.phase !== "throw") return;
              confirmSpin();
            }}
            aria-label="Бросить жребий"
            // No `opacity` class on this button, ever. `opacity < 1` forces the
            // used value of `transform-style` back to `flat` — the same
            // flattening the `.cam` shake caused, from a property nobody thinks
            // of as 3D. With `opacity-60` here the cube collapsed to a plate in
            // every phase it wasn't throwable in (idle, and everything from the
            // result on), and when a throw happened to land on палка or
            // кистень — the ±90° faces — the collapsed plate was edge-on and
            // the cube disappeared outright. The dimming lives on each face
            // below instead, where it is a leaf and flattens nothing.
            className={`relative border-none bg-transparent p-0 ${throwable ? "cursor-pointer" : "pointer-events-none cursor-default"}`}
            style={{
              width: 132,
              height: 132,
              transformStyle: "preserve-3d",
              transition: cubeThrowCss(spinMs),
              transform: `rotateX(${state.rx}deg) rotateY(${state.ry}deg)`,
            }}
          >
            {CUBE_FACE_KEYS.map((key, i) => {
              const Icon = FACE_ICONS[key];
              const isOutcome = state.lot === i && state.phase !== "throw";
              // Waiting for a fighter is the one phase with nothing to throw,
              // so the cube sits back — in colour only. An `opacity` below 1
              // on a face turns the cube to glass: you see its own back faces
              // and their glyphs through the front one, which reads as a wire
              // box rather than a solid жребий.
              const resting = state.phase === "idle";
              const ink = resting ? "color-mix(in srgb, var(--iron) 52%, var(--surface))" : "var(--iron)";
              return (
                <span
                  key={key}
                  className="absolute inset-0 grid place-items-center border"
                  style={{
                    background: "var(--surface)",
                    borderColor: isOutcome ? "var(--accent)" : ink,
                    color: isOutcome ? "var(--accent)" : ink,
                    // Загорается — the drawn разряд's face lights up when the
                    // cube stops, rather than only changing the ink colour on
                    // a face the old flat-plate rendering barely showed.
                    boxShadow: isOutcome
                      ? "inset 0 0 34px rgba(0,0,0,.45), 0 0 22px -6px var(--accent)"
                      : "inset 0 0 34px rgba(0,0,0,.6)",
                    transition: "box-shadow 420ms ease, border-color 420ms ease, color 420ms ease",
                    transform: FACE_TRANSFORMS[i],
                  }}
                >
                  <Icon size={54} />
                </span>
              );
            })}
          </button>
        </div>
        </div>
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
