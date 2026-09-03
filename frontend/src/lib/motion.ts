import type { Transition } from "framer-motion";

/**
 * Пляска-derived motion vocabulary.
 *
 * Four small, named primitives standing in for the movement grammar of the
 * tradition's ritual dance-challenge (шаг → остановка → разворот → импульс).
 * These are not a new physics model — they formalize timing/easing curves
 * already scattered through the tournament UI (the flip ease in
 * `monogram-flip.tsx`/`site-header.tsx`, the spring in
 * `competition-workspace.tsx`'s tab indicator) so new motion draws from one
 * shared vocabulary instead of one-off literals.
 */

/** разворот (turn) — the one rotate arc already used for every flip in the app. */
export const TURN_EASE = [0.16, 1, 0.3, 1] as const;

/** остановка (stop) — a decisive settle after a step/turn/toss: high damping, minimal overshoot. */
export const STOP_SPRING: Transition = { type: "spring", stiffness: 400, damping: 30 };

/** импульс (impulse) — the shared tap-feedback shape: a quick compress with a snappy return. */
export const IMPULSE_TAP = { scale: 0.96 } as const;
export const IMPULSE_SPRING: Transition = { type: "spring", stiffness: 500, damping: 22 };

/** шаг (step) — a short, sharp step-in (translate + fade), for one-shot entrance stagger. */
export function stepIn(offset = 8): { initial: { opacity: number; y: number }; animate: { opacity: number; y: number }; transition: Transition } {
  return {
    initial: { opacity: 0, y: offset },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] },
  };
}

/**
 * "Живой архив" v3 additions — the ПОЕДИНОК/СЕТКА interactive centerpiece's
 * phase-driven motion. `impulse`/`swing`/`step`/`flow`/`ken`/`unmask`/
 * `draw-x`/`draw-y`/`letter`/`dust` stay pure CSS classes in globals.css
 * (server-renderable or trivially toggled by a conditional className,
 * already covered by that file's global `prefers-reduced-motion` override).
 * The primitives below are the ones that genuinely need JS: they're driven
 * by React state transitions (the lot cube's resting angle, a mirrored
 * fighter pair, camera shake gated to one phase) rather than a class toggle.
 */

/** тень (throw) — the lot cube's spin-to-result transition. Two full turns
 *  get added on top of the target face angle by the caller so every throw
 *  visibly spins, never snaps; divide `spinMs` by `ritualSpeed` (0.6–1.6). */
const THROW_EASE = [0.16, 0.86, 0.24, 1] as const;

export function cubeThrow(spinMs: number): Transition {
  return { duration: spinMs / 1000, ease: THROW_EASE };
}

/** Same throw curve as `cubeThrow`, as a plain CSS `transition` value — for
 *  the lot cube's raw inline `style.transition` (a plain DOM button, not a
 *  `motion.button`), so the two never drift apart into different curves. */
export function cubeThrowCss(spinMs: number, property = "transform"): string {
  return `${property} ${spinMs}ms cubic-bezier(${THROW_EASE.join(",")})`;
}

/** дрожь (cam) — scene shake while the cube is spinning, framer-motion form
 *  for a component that also needs `AnimatePresence`/exit handling nearby
 *  (the CSS `.cam` class in globals.css covers the plain case). */
export const CAM_SHAKE: { animate: { x: number[]; y: number[] }; transition: Transition } = {
  animate: { x: [0, 2, -2, 2, 0], y: [0, -2, 2, -2, 0] },
  transition: { duration: 0.28, repeat: Infinity, ease: "linear" },
};

/** выпад (lunge) — mirrored fighter step-in on clash. `side: 1` for the
 *  right-hand fighter, `-1` for the left, matching `lunge-a`/`lunge-b`. */
export function lunge(side: 1 | -1): { animate: { x: number[]; rotateY: number[] }; transition: Transition } {
  return {
    animate: { x: [0, side * 34, 0], rotateY: [0, side * -6, 0] },
    transition: { duration: 0.76, ease: "easeInOut" },
  };
}

/** буква (letter) — per-letter stagger delay for the kinetic fighter name;
 *  pair with the `.letter` CSS class (`animation-delay` via inline style). */
export function letterDelayMs(index: number): number {
  return index * 45;
}
