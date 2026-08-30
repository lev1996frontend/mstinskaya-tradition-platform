"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Dices, Hand } from "lucide-react";
import { useState } from "react";

import { Alert, Button, cn } from "@/components/ui";
import { drawLot, overrideLot } from "@/api/tournaments";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import { weaponCategory } from "@/lib/labels";
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
 */

/** Documented in `domain/rules.py`: a d4, one face per category, no remainder. */
const FACE_TO_WEAPON: Record<number, WeaponCategory> = {
  1: "PALKA",
  2: "NOZH",
  3: "HANDS",
  4: "KISTEN",
};

const FACES = [1, 2, 3, 4];

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) return "Не удалось связаться с API.";
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Жребий бросает организатор или инструктор.";
    return error.message;
  }
  return "Не удалось бросить жребий.";
}

/** A d4 token that tumbles, then settles on the face the backend returned. */
function DieToken({ face, rolling }: { face: number | null; rolling: boolean }) {
  const reduceMotion = useReducedMotion();
  const weapon = face ? FACE_TO_WEAPON[face] : null;

  return (
    <motion.div
      aria-hidden="true"
      className="flex size-16 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--gold)]/50 bg-[linear-gradient(180deg,var(--gold-soft),var(--surface-muted))] text-[var(--gold-strong)]"
      animate={
        reduceMotion || !rolling
          ? { rotate: 0, scale: 1 }
          : { rotate: [0, 120, 260, 380, 360], scale: [1, 1.06, 0.97, 1.03, 1] }
      }
      transition={reduceMotion || !rolling ? { duration: 0 } : { duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
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
  const [mode, setMode] = useState<LotMethod>("ONLINE_DICE");
  const [physicalFace, setPhysicalFace] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [rolling, setRolling] = useState(false);
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

      // …and only then does the token tumble, landing on that exact face.
      setRevealed(lot.die_value);
      setRolling(true);
      window.setTimeout(() => {
        setRolling(false);
        onDrawn();
      }, 800);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    !busy &&
    !disabled &&
    (mode === "ONLINE_DICE" || physicalFace !== null) &&
    (!isOverride || reason.trim().length >= 3);

  return (
    <div className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)]/50 p-3">
      <div className="flex items-center gap-3">
        <DieToken face={revealed ?? (weapon ? faceOf(weapon) : null)} rolling={rolling} />
        <div className="min-w-0">
          <p className="record-label text-[var(--iron-muted)]">
            {sideLabel} · {fighterName}
          </p>
          <p aria-live="polite" className="mt-0.5 text-sm font-semibold">
            {settled ? weaponCategory[weapon] : "Жребий не брошен"}
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
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={busy || disabled}
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
                </button>
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
                    <button
                      key={face}
                      type="button"
                      disabled={busy || disabled}
                      aria-pressed={active}
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
                      <span className="font-display text-xs tabular-nums">{face}</span>
                    </button>
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
              className="w-full rounded-[var(--radius-sm)] border border-[var(--iron-line)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-[var(--muted)]"
            />
          ) : null}

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Button
            type="button"
            size="sm"
            variant={isOverride ? "secondary" : "primary"}
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {busy ? "Бросаем…" : isOverride ? "Перебросить жребий" : "Бросить жребий"}
          </Button>
        </>
      )}
    </div>
  );
}

function faceOf(weapon: WeaponCategory): number {
  const entry = Object.entries(FACE_TO_WEAPON).find(([, value]) => value === weapon);
  return entry ? Number(entry[0]) : 1;
}
