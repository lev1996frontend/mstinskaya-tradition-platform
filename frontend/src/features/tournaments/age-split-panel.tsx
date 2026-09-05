"use client";

import { Scissors, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { applyAgeSplit } from "@/api/tournaments";
import { Alert, Badge, Button, Card, cn } from "@/components/ui";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import type { AgeSplitView } from "@/types";

/**
 * Cutting a children's category into age streams.
 *
 * An «Абсолютная детская» holding both an eight-year-old and a fourteen-year-
 * old is not one field. The streams below are not a suggestion the platform
 * dreamed up: they follow arithmetically from the age gap the organizer set on
 * the discipline and the entrants who actually turned up.
 *
 * A stream holding one fighter is shown as such rather than quietly merged
 * into its neighbour — merging is exactly what the gap exists to prevent, so
 * the choice between running it, widening the gap and leaving the discipline
 * whole belongs to the organizer.
 */

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) return "Не удалось связаться с API.";
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Действие доступно организатору или инструктору.";
    if (error.status === 409) return "Разделить пока нельзя — проверьте список ниже.";
    if (error.status === 400) return "Делить нечего: разброс укладывается в допустимый.";
    return error.message;
  }
  return "Не удалось разделить дисциплину.";
}

export function AgeSplitPanel({
  state,
  canManage = false,
  onSplit,
}: {
  state: AgeSplitView;
  canManage?: boolean;
  onSplit?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">Возрастные потоки</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Заявлено {state.participant_count}, возраст от {state.age_min} до {state.age_max} —
          разброс {state.age_spread}{" "}
          {state.max_age_gap !== null ? (
            <>
              при допустимом {state.max_age_gap}. Дисциплина разойдётся на отдельные потоки, у
              каждого своя сетка и свой победитель.
            </>
          ) : (
            <>лет.</>
          )}
        </p>
      </div>

      {state.blockers.length > 0 ? (
        <Alert tone="warning" title="Пока нельзя делить">
          <ul className="mt-1 space-y-1">
            {state.blockers.map((blocker) => (
              <li key={`${blocker.code}-${blocker.message}`} className="flex items-start gap-1.5">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
                <span>{blocker.message}</span>
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {state.bands.map((band) => (
          <li
            key={band.label}
            className={cn(
              "rounded-[var(--radius-sm)] border p-3",
              band.is_lonely ? "border-[var(--warning)]/60" : "border-[var(--border)]",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="record-label text-[var(--chrome-muted)]">{band.name}</p>
              {band.is_lonely ? <Badge tone="warning">один боец</Badge> : null}
            </div>
            <ol className="mt-1.5 space-y-0.5 text-sm">
              {band.members.map((member) => (
                <li key={member.participant_id} className="flex gap-2">
                  <span className="font-record text-xs text-[var(--muted)]">{member.age}</span>
                  <span className="min-w-0 truncate">{member.display_name}</span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>

      {state.bands.some((band) => band.is_lonely) ? (
        <Alert tone="warning" title="В потоке остаётся один боец">
          Подклеивать его к соседнему потоку платформа не станет — ради этого разрыв и задаётся.
          Можно разделить как есть, увеличить допустимый разрыв или оставить дисциплину неделёной.
        </Alert>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {canManage ? (
        <div className="border-t border-[var(--border)] pt-3">
          <Button
            type="button"
            disabled={!state.ready || busy}
            icon={<Scissors className="size-3.5" strokeWidth={2.25} />}
            onClick={() => {
              setBusy(true);
              setError(null);
              void applyAgeSplit(state.competition_id)
                .then(() => onSplit?.())
                .catch((caught) => setError(describeError(caught)))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Делим…" : `Разделить на ${state.bands.length} потока`}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
