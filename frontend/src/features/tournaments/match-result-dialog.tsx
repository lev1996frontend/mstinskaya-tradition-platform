"use client";

import { useEffect, useRef, useState } from "react";

import { recordMatchResult, updateMatchResult, updateMatchStatus } from "@/api/tournaments";
import { Alert, Button } from "@/components/ui";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { resultMethod } from "@/lib/labels";
import type { MatchView, ResultMethod } from "@/types";

const METHODS = Object.keys(resultMethod) as ResultMethod[];

const NO_WINNER = "__none__";

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) {
    return "Не удалось связаться с API. Проверьте, что бэкенд запущен.";
  }
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Недостаточно прав для изменения результата.";
    return error.message;
  }
  return "Не удалось сохранить результат.";
}

export function MatchResultDialog({
  match,
  onClose,
  onSaved,
}: {
  match: MatchView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isCorrection = Boolean(match.result);
  const dialogRef = useRef<HTMLDivElement>(null);

  const [winnerId, setWinnerId] = useState<string>(match.result?.winner_id ?? NO_WINNER);
  const [method, setMethod] = useState<ResultMethod>(match.result?.method ?? "JUDGE_DECISION");
  const [comment, setComment] = useState(match.result?.comment ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    dialogRef.current?.querySelector<HTMLElement>("select, input, button")?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const sides = [match.participant_a, match.participant_b].filter(
    (side): side is NonNullable<typeof side> => Boolean(side),
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const winner = winnerId === NO_WINNER ? null : winnerId;
    const trimmedComment = comment.trim() ? comment.trim() : null;

    try {
      if (isCorrection) {
        await updateMatchResult(match.id, {
          winner_id: winner,
          method,
          comment: trimmedComment,
          reason: reason.trim() ? reason.trim() : null,
        });
      } else {
        await recordMatchResult(match.id, { winner_id: winner, method, comment: trimmedComment });
      }
      onSaved();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelMatch() {
    setSaving(true);
    setError(null);
    try {
      await updateMatchStatus(match.id, {
        status: "CANCELLED",
        reason: reason.trim() ? reason.trim() : null,
      });
      onSaved();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-result-title"
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl sm:rounded-2xl"
      >
        <h2 id="match-result-title" className="text-lg font-semibold">
          {isCorrection ? "Изменение результата" : "Результат боя"}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {match.participant_a?.display_name ?? "—"} — {match.participant_b?.display_name ?? "—"}
        </p>

        {isCorrection && match.result ? (
          <div className="mt-4">
            <Alert tone="warning" title="Результат уже внесён">
              Записан {formatDateTime(match.result.recorded_at)}. Предыдущее значение будет
              сохранено в журнале дисциплины — история не теряется.
            </Alert>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <Field label="Победитель">
            {(props) => (
              <Select
                {...props}
                value={winnerId}
                onChange={(event) => setWinnerId(event.target.value)}
                disabled={saving}
              >
                {sides.map((side) => (
                  <option key={side.id} value={side.id}>
                    {side.display_name}
                  </option>
                ))}
                <option value={NO_WINNER}>Без победителя</option>
              </Select>
            )}
          </Field>

          <Field
            label="Основание"
            hint="Платформа хранит только решение, без очков — согласно спецификации турнирного движка."
          >
            {(props) => (
              <Select
                {...props}
                value={method}
                onChange={(event) => setMethod(event.target.value as ResultMethod)}
                disabled={saving}
              >
                {METHODS.map((value) => (
                  <option key={value} value={value}>
                    {resultMethod[value]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Комментарий" hint="Необязательно.">
            {(props) => (
              <Textarea
                {...props}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                disabled={saving}
                placeholder="Пояснение судейской коллегии"
              />
            )}
          </Field>

          {isCorrection ? (
            <Field label="Причина изменения" hint="Попадёт в журнал дисциплины.">
              {(props) => (
                <Input
                  {...props}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={saving}
                  placeholder="Например: пересмотр решения судей"
                />
              )}
            </Field>
          ) : null}

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="submit" disabled={saving}>
              {saving ? "Сохранение…" : isCorrection ? "Сохранить изменение" : "Записать результат"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Отмена
            </Button>
            {match.status !== "CANCELLED" && !match.result ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleCancelMatch()}
                disabled={saving}
                className="ml-auto"
              >
                Отменить бой
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
