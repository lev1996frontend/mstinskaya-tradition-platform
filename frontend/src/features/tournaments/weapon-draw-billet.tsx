"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { WEAPON_MOTIFS } from "@/components/brand/weapon-glyphs";
import { Badge, Button, Card } from "@/components/ui";
import { IMPULSE_SPRING, IMPULSE_TAP, TURN_EASE } from "@/lib/motion";

import { LOT_ANTICIPATION_MS } from "./lot-dice";

const SIZE = 96;
const HEIGHT = 220;
const HALF = SIZE / 2;
const EXTRA_TURNS = 3;

type Phase = "idle" | "anticipate" | "flip";

/**
 * A teaching aid, and explicitly labelled as one.
 *
 * The real жребий now exists: it is drawn per bout in the judge panel
 * (`lot-dice.tsx`), where the value comes from the server and is persisted and
 * audited. This widget spins a local `Math.random()` and writes nothing, so the
 * copy below states plainly that it is an illustration and points at where the
 * real draw happens — otherwise the page would carry two lot UIs that both look
 * live. It is kept because the carved-billet mechanic explains the tradition to
 * a first-time visitor better than prose does.
 */
export function WeaponDrawBillet() {
  const [rotation, setRotation] = useState(0);
  // The face the current/next flip is headed to — drives the *visual*
  // rotation (via `rotation` above) as soon as the flip starts. `faceIndex`
  // below is separate on purpose: it drives the "Выпало: …" text, and only
  // gets set once the flip actually finishes turning, not when it starts.
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [faceIndex, setFaceIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const reduceMotion = useReducedMotion();

  const roll = () => {
    const nextIndex = Math.floor(Math.random() * WEAPON_MOTIFS.length);
    const targetMod = (((-nextIndex * 90) % 360) + 360) % 360;
    const currentMod = ((rotation % 360) + 360) % 360;
    let delta = targetMod - currentMod;
    if (delta <= 0) delta += 360;
    const extraTurns = reduceMotion ? 0 : EXTRA_TURNS * 360;
    // напряжение (a brief compress) before бросок — timed to match the real
    // жребий's anticipation beat (`lot-dice.tsx`) so the product's two toss
    // mechanics share one felt rhythm.
    setPhase("anticipate");
    window.setTimeout(
      () => {
        setRotation(rotation + delta + extraTurns);
        setPendingIndex(nextIndex);
        setPhase("flip");
      },
      reduceMotion ? 0 : LOT_ANTICIPATION_MS,
    );
  };

  const result = faceIndex === null ? null : WEAPON_MOTIFS[faceIndex];

  return (
    <Card className="flex flex-col items-center gap-5 px-6 py-8 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
      <div className="max-w-sm space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Как проходит жеребьёвка
          </h2>
          <Badge>Наглядно</Badge>
        </div>
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Перед поединком участники кидают жребий по деревянному бруску: на каждой из четырёх
          граней — свой вид оружия. Какая грань выпадет — с тем и выходят биться.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={roll} className="mt-1">
          Покрутить для примера
        </Button>
        <p aria-live="polite" className="min-h-5 text-sm font-medium text-[var(--accent)]">
          {result ? `Выпало: ${result.label}` : ""}
        </p>
        <p className="text-xs text-[var(--muted)]">
          Это демонстрация. Настоящий жребий бросается в карточке поединка, его результат
          определяет сервер и сразу записывает в журнал дисциплины.
        </p>
      </div>

      {/* Clickable too, not just the "Покрутить для примера" button below —
          matches the homepage Поединок demo's own lot cube (`lot-cube.tsx`),
          where the die itself has always been the primary target. `role`/
          `tabIndex`/`onKeyDown` since a `motion.div` isn't natively
          focusable or triggerable from the keyboard the way a `<button>` is. */}
      <div
        role="button"
        tabIndex={0}
        onClick={roll}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          roll();
        }}
        aria-label="Покрутить брусок для примера"
        className="mx-auto shrink-0 cursor-pointer"
        style={{ width: SIZE, height: HEIGHT, perspective: 700 }}
      >
        <motion.div
          className="relative h-full w-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={
            phase === "anticipate"
              ? { rotateY: rotation, scale: IMPULSE_TAP.scale }
              : { rotateY: rotation, scale: phase === "flip" ? [IMPULSE_TAP.scale, 1.05, 1] : 1 }
          }
          transition={
            reduceMotion
              ? { duration: 0 }
              : phase === "anticipate"
                ? IMPULSE_SPRING
                : { duration: 1.3, ease: TURN_EASE }
          }
          onAnimationComplete={() => {
            // Fires for the "anticipate" compress too — only the flip's own
            // completion should reveal the result text.
            if (phase !== "flip" || pendingIndex === null) return;
            setFaceIndex(pendingIndex);
          }}
        >
          {WEAPON_MOTIFS.map(({ key, Icon }, index) => (
            <div
              key={key}
              className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--gold)]/40 bg-[linear-gradient(180deg,var(--gold-soft),var(--surface-muted))]"
              style={{
                backfaceVisibility: "hidden",
                transform: `rotateY(${index * 90}deg) translateZ(${HALF}px)`,
              }}
            >
              <Icon size={30} className="text-[var(--gold-strong)]" />
            </div>
          ))}
        </motion.div>
      </div>
    </Card>
  );
}
