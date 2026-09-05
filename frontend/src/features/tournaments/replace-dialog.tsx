"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { replaceWithdrawnParticipant } from "@/api/tournaments";
import { Alert, Button } from "@/components/ui";
import { Field, Textarea } from "@/components/ui/form";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import { useFocusTrap } from "@/lib/use-focus-trap";
import type { ParticipantView } from "@/types";

import { ReplacementPicker } from "./replacement-picker";

/**
 * Standing someone in for a fighter who was already withdrawn.
 *
 * The case this exists for: the fighter pulled out in the morning and the club
 * found a stand-in an hour later. By then the walkover has been granted and the
 * opponent advanced, so the backend takes both back — and refuses if that
 * opponent has since fought the bout they were advanced into. The warning below
 * says so before the organizer commits, because from the table it looks like a
 * simple swap.
 */

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) {
    return "Не удалось связаться с API. Проверьте, что бэкенд запущен.";
  }
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Заменить участника может только организатор или инструктор.";
    const detail = error.detail as { code?: string; message?: string } | null;
    if (detail?.message) return detail.message;
    return error.message;
  }
  return "Не удалось поставить замену.";
}

export function ReplaceDialog({
  participant,
  onClose,
  onSaved,
}: {
  participant: ParticipantView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const [replacement, setReplacement] = useState<string | null>(null);
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

  const trimmed = reason.trim();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (trimmed.length < 3 || !replacement) return;
    setSaving(true);
    setError(null);
    try {
      await replaceWithdrawnParticipant(participant.id, {
        reason: trimmed,
        replacement_participant_id: replacement,
      });
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
        aria-labelledby="replace-title"
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)] sm:rounded-[var(--radius-lg)]"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 id="replace-title" className="text-lg font-semibold">
          Поставить замену
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Вместо: {participant.display_name}</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <Alert tone="warning" title="Проход без боя будет отменён">
            Соперник, получивший проход при снятии, вернётся в свой бой и выйдет из следующего
            круга. Если он уже успел провести следующий бой, замену поставить нельзя — состоявшийся
            поединок не стирается.
          </Alert>

          <ReplacementPicker
            key={participant.id}
            participantId={participant.id}
            value={replacement}
            onChange={setReplacement}
            disabled={saving}
            allowNone={false}
          />

          <Field label="Причина" hint="Попадёт в журнал дисциплины и в историю участника">
            {(props) => (
              <Textarea
                {...props}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={saving}
                placeholder="Клуб выставил запасного"
              />
            )}
          </Field>

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Отмена
            </Button>
            <Button type="submit" disabled={saving || trimmed.length < 3 || !replacement}>
              {saving ? "Сохраняем…" : "Поставить"}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
