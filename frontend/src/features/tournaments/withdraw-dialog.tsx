"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { withdrawParticipant } from "@/api/tournaments";
import { Alert, Button, cn } from "@/components/ui";
import { Field, Textarea } from "@/components/ui/form";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import { labelOf, matchStage } from "@/lib/labels";
import { useFocusTrap } from "@/lib/use-focus-trap";
import type { MatchView, ParticipantView } from "@/types";

/**
 * Taking a fighter out of a competition that has already started.
 *
 * Deliberately shows the consequence before asking for confirmation: a
 * withdrawal is not a quiet status change, it hands specific bouts to specific
 * people. The list below is computed from the matches the page already holds,
 * purely so the organizer can see what they are about to do — the backend
 * decides which bouts are actually settled and to whom, and its answer is what
 * gets shown afterwards.
 */

const REASONS: { status: "WITHDRAWN" | "DISQUALIFIED"; label: string; hint: string }[] = [
  { status: "WITHDRAWN", label: "Снялся", hint: "Травма, отказ, не вышел на бой" },
  { status: "DISQUALIFIED", label: "Дисквалифицирован", hint: "Решение судейской коллегии" },
];

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) {
    return "Не удалось связаться с API. Проверьте, что бэкенд запущен.";
  }
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Снять участника может только организатор или инструктор.";
    if (error.status === 409) {
      // The backend refuses while a bout of theirs is under way, and says which.
      const detail = error.detail as { code?: string; message?: string } | null;
      if (detail?.code === "BOUT_IN_FLIGHT" && detail.message) return detail.message;
      return "Участник уже выбыл из сетки.";
    }
    return error.message;
  }
  return "Не удалось снять участника.";
}

export function WithdrawDialog({
  participant,
  matches,
  onClose,
  onSaved,
}: {
  participant: ParticipantView;
  matches: MatchView[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const [status, setStatus] = useState<"WITHDRAWN" | "DISQUALIFIED">("WITHDRAWN");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    dialogRef.current?.querySelector<HTMLElement>("button, textarea")?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useFocusTrap(dialogRef, true);

  // The same split the backend makes: bouts that can be awarded now, and bouts
  // whose opponent is not known yet and will be settled later on their own.
  const { awardable, deferred } = useMemo(() => {
    const theirs = matches.filter(
      (match) =>
        match.status !== "FINISHED" &&
        match.status !== "CANCELLED" &&
        [match.participant_a?.id, match.participant_b?.id].includes(participant.id),
    );
    return {
      awardable: theirs.filter(
        (match) => Boolean(match.participant_a) && Boolean(match.participant_b),
      ),
      deferred: theirs.filter(
        (match) => !match.participant_a || !match.participant_b,
      ),
    };
  }, [matches, participant.id]);

  function opponentOf(match: MatchView): string {
    const other = match.participant_a?.id === participant.id ? match.participant_b : match.participant_a;
    return other?.display_name ?? "—";
  }

  const trimmed = reason.trim();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (trimmed.length < 3) return;
    setSaving(true);
    setError(null);
    try {
      await withdrawParticipant(participant.id, { reason: trimmed, status });
      onSaved();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-title"
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)] sm:rounded-[var(--radius-lg)]"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 id="withdraw-title" className="text-lg font-semibold">
          Снять участника
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{participant.display_name}</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div role="radiogroup" aria-label="Причина выбытия" className="grid gap-2 sm:grid-cols-2">
            {REASONS.map((option) => {
              const active = status === option.status;
              return (
                <button
                  key={option.status}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={saving}
                  onClick={() => setStatus(option.status)}
                  className={cn(
                    "rounded-[var(--radius-sm)] border px-3 py-2.5 text-left transition-colors disabled:opacity-55",
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--border-strong)] text-[var(--muted)] hover:bg-[var(--surface-muted)]",
                  )}
                >
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="mt-0.5 block text-xs opacity-80">{option.hint}</span>
                </button>
              );
            })}
          </div>

          {awardable.length > 0 ? (
            <Alert tone="warning" title="Эти бои будут отданы соперникам">
              <ul className="mt-1 space-y-1">
                {awardable.map((match) => (
                  <li key={match.id}>
                    {labelOf(matchStage, match.stage)} — проход получает {opponentOf(match)}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {deferred.length > 0 ? (
            <Alert tone="info" title="Соперник ещё не определён">
              {deferred.map((match) => labelOf(matchStage, match.stage)).join(", ")}: проход будет засчитан
              автоматически, как только другая половина сетки даст соперника.
            </Alert>
          ) : null}

          <Field label="Причина" hint="Попадёт в журнал дисциплины и в историю участника">
            {(props) => (
              <Textarea
                {...props}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={saving}
                placeholder="Травма плеча"
              />
            )}
          </Field>

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Отмена
            </Button>
            <Button type="submit" variant="danger" disabled={saving || trimmed.length < 3}>
              {saving ? "Сохраняем…" : "Снять"}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
