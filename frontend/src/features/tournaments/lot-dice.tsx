"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Dices, Hand } from "lucide-react";
import { useState } from "react";

import { Alert, Button, cn } from "@/components/ui";
import { drawLot, overrideLot } from "@/api/tournaments";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import { weaponCategory } from "@/lib/labels";
import { IMPULSE_SPRING, IMPULSE_TAP, TURN_EASE } from "@/lib/motion";
import type { BoutSide, LotMethod, WeaponCategory } from "@/types";

import { WeaponGlyph } from "./weapon-mark";

/**
 * The жребий, for real.
 *
 * Neither mode invents a value in the browser:
 *
 * * **Живой кубик** — the judge rolls a physical d4 and enters the face; that
 *   face is sent and stored.
 * * **Онлайн** — the server rolls with `secrets`, persists the lot, and returns
 *   it. The tumble below only *reveals* a result that already exists in the
 *   database; it never picks one.
 *
 * There is no client-side randomness anywhere in this file.
 *
 * The ritual is staged in three beats — напряжение → бросок → остановка —
 * rather than one flat tumble: a brief anticipatory compress before the toss
 * starts (`anticipate`), the toss itself, then a landing whose last segment
 * eases into a small overshoot-and-settle instead of stopping dead (see the
 * `ease` array on the tumble transition below — a spring type can't drive a
 * multi-keyframe rotation, so the "settle" character is carried by shaping
 * that last segment's easing curve instead).
 */

/** Documented in `domain/rules.py`: a d4, one face per category, no remainder. */
const FACE_TO_WEAPON: Record<number, WeaponCategory> = {
  1: "PALKA",
  2: "NOZH",
  3: "HANDS",
  4: "KISTEN",
};

const FACES = [1, 2, 3, 4];

/** Anticipation hold before the toss starts, in ms — matched by `weapon-draw-billet.tsx`
 *  so the product's two toss mechanics (the real жребий and the teaching billet) share one felt rhythm. */
export const LOT_ANTICIPATION_MS = 110;

type Phase = "idle" | "anticipate" | "tumble";

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) return "Не удалось связаться с API.";
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Жребий бросает организатор или инструктор.";
    return error.message;
  }
  return "Не удалось бросить жребий.";
}

/** A d4 token that compresses, tumbles, then lands on the face the backend returned. */
function DieToken({
  face,
  phase,
  onTumbleComplete,
}: {
  face: number | null;
  phase: Phase;
  onTumbleComplete?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const weapon = face ? FACE_TO_WEAPON[face] : null;

  const animate = reduceMotion
    ? { rotate: 0, scale: 1 }
    : phase === "anticipate"
      ? { rotate: 0, scale: IMPULSE_TAP.scale }
      : phase === "tumble"
        ? { rotate: [0, 120, 260, 380, 360], scale: [0.96, 1.06, 0.97, 1.03, 1] }
        : { rotate: 0, scale: 1 };

  const transition = reduceMotion
    ? { duration: 0 }
    : phase === "anticipate"
      ? IMPULSE_SPRING
      : phase === "tumble"
        ? {
            duration: 0.75,
            times: [0, 0.32, 0.58, 0.8, 1],
            // last segment overshoots slightly then settles — the "остановка"
            // beat, shaped as an easing curve since a spring can't drive a
            // multi-keyframe rotation.
            ease: [
              [0.42, 0, 1, 1],
              [0.42, 0, 0.58, 1],
              [0.42, 0, 0.58, 1],
              [0.34, 1.56, 0.64, 1],
            ] as [number, number, number, number][],
          }
        : { duration: 0.2, ease: TURN_EASE };

  return (
    <motion.div
      aria-hidden="true"
      className="flex size-16 shrink-0 items-center justify-center rounded-full border border-[var(--gold)]/50 bg-[linear-gradient(180deg,var(--gold-soft),var(--surface-muted))] text-[var(--gold-strong)]"
      animate={animate}
      transition={transition}
      onAnimationComplete={() => {
        if (phase === "tumble") onTumbleComplete?.();
      }}
    >
      {weapon ? (
        <WeaponGlyph weapon={weapon} size={30} />
      ) : (
        <Dices className="size-7" strokeWidth={1.5} />
      )}
    </motion.div>
  );
}

export function LotDice({
  matchId,
  side,
  sideLabel,
  fighterName,
  weapon,
  disabled = false,
  isOverride = false,
  onDrawn,
}: {
  matchId: string;
  side: BoutSide;
  sideLabel: string;
  fighterName: string;
  /** Already-drawn weapon, straight from the backend. */
  weapon: WeaponCategory | null;
  disabled?: boolean;
  /** Switches to the audited admin-correction endpoint. */
  isOverride?: boolean;
  onDrawn: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<LotMethod>("ONLINE_DICE");
  const [physicalFace, setPhysicalFace] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [revealed, setRevealed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settled = weapon !== null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body = {
        side,
        method: mode,
        die_value: mode === "PHYSICAL_DICE" ? physicalFace : null,
      };
      // The result comes back already fixed and already persisted…
      const lot = isOverride
        ? await overrideLot(matchId, { ...body, reason: reason.trim() })
        : await drawLot(matchId, body);

      // …напряжение (a brief compress) …
      setPhase("anticipate");
      window.setTimeout(
        () => {
          // …бросок (the toss lands on that exact face) …
          setRevealed(lot.die_value);
          setPhase("tumble");
        },
        reduceMotion ? 0 : LOT_ANTICIPATION_MS,
      );
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)]/50 p-3">
      <div className="flex items-center gap-3">
        <DieToken
          face={revealed ?? (weapon ? faceOf(weapon) : null)}
          phase={phase}
          onTumbleComplete={() => {
            // …остановка: the toss is over, the record is written.
            setPhase("idle");
            onDrawn();
          }}
        />
        <div className="min-w-0">
          <p className="record-label text-[var(--chrome-muted)]">
            {sideLabel} · {fighterName}
          </p>
          <p aria-live="polite" className="mt-0.5 text-sm font-semibold">
            <AnimatePresence mode="wait" initial={false}>
              {settled && weapon ? (
                <motion.span
                  key="result"
                  initial={reduceMotion ? undefined : { opacity: 0, scale: 0.92, filter: "blur(3px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  transition={{ duration: 0.28, ease: TURN_EASE }}
                  className="inline-block"
                >
                  {weaponCategory[weapon]}
                </motion.span>
              ) : (
                <motion.span key="empty" className="inline-block">
                  Жребий не брошен
                </motion.span>
              )}
            </AnimatePresence>
          </p>
        </div>
      </div>

      {settled && !isOverride ? null : (
        <>
          <div role="radiogroup" aria-label="Способ жеребьёвки" className="grid grid-cols-2 gap-2">
            {(["ONLINE_DICE", "PHYSICAL_DICE"] as LotMethod[]).map((option) => {
              const active = mode === option;
              const Icon = option === "ONLINE_DICE" ? Dices : Hand;
              return (
                <motion.button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={busy || disabled}
                  whileTap={reduceMotion ? undefined : IMPULSE_TAP}
                  transition={IMPULSE_SPRING}
                  onClick={() => setMode(option)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-2 text-xs transition-colors disabled:opacity-55",
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--border-strong)] text-[var(--muted)] hover:bg-[var(--surface-muted)]",
                  )}
                >
                  <Icon className="size-3.5" strokeWidth={2} />
                  {option === "ONLINE_DICE" ? "Онлайн" : "Живой кубик"}
                </motion.button>
              );
            })}
          </div>

          {mode === "PHYSICAL_DICE" ? (
            <div className="space-y-1.5">
              <p className="text-xs text-[var(--muted)]">
                Бросьте четырёхгранный кубик и укажите выпавшую грань.
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {FACES.map((face) => {
                  const active = physicalFace === face;
                  return (
                    <motion.button
                      key={face}
                      type="button"
                      disabled={busy || disabled}
                      aria-pressed={active}
                      whileTap={reduceMotion ? undefined : IMPULSE_TAP}
                      transition={IMPULSE_SPRING}
                      onClick={() => setPhysicalFace(face)}
                      title={weaponCategory[FACE_TO_WEAPON[face]]}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-[var(--radius-sm)] border px-1 py-2 transition-colors disabled:opacity-55",
                        active
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "border-[var(--border-strong)] text-[var(--muted)] hover:bg-[var(--surface-muted)]",
                      )}
                    >
                      <WeaponGlyph weapon={FACE_TO_WEAPON[face]} size={18} />
                      <span className="font-record text-xs">{face}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              Результат определяет сервер и сразу записывает его в журнал — изменить его из
              браузера нельзя.
            </p>
          )}

          {isOverride ? (
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
              placeholder="Причина изменения жребия (обязательно)"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--chrome-line)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-[var(--muted)]"
            />
          ) : null}

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Button
            type="button"
            size="sm"
            variant={isOverride ? "secondary" : "primary"}
            disabled={!canSubmitFrom(busy, disabled, mode, physicalFace, isOverride, reason)}
            onClick={() => void submit()}
          >
            {busy ? "Бросаем…" : isOverride ? "Перебросить жребий" : "Бросить жребий"}
          </Button>
        </>
      )}
    </div>
  );
}

function canSubmitFrom(
  busy: boolean,
  disabled: boolean,
  mode: LotMethod,
  physicalFace: number | null,
  isOverride: boolean,
  reason: string,
): boolean {
  return (
    !busy &&
    !disabled &&
    (mode === "ONLINE_DICE" || physicalFace !== null) &&
    (!isOverride || reason.trim().length >= 3)
  );
}

function faceOf(weapon: WeaponCategory): number {
  const entry = Object.entries(FACE_TO_WEAPON).find(([, value]) => value === weapon);
  return entry ? Number(entry[0]) : 1;
}
