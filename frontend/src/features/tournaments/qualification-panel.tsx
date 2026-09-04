"use client";

import { Network, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { generatePlayoff } from "@/api/tournaments";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import type { QualificationView } from "@/types";

import { CityVerdict, PairPreview, PlanSummary } from "./bracket-generator";

/**
 * Who came out of the groups, and the playoff they seed.
 *
 * The order shown — all the winners, then all the runners-up, then all the
 * thirds — *is* the cross-seeding. Handed to the ordinary bracket planner as
 * seeds 1..n it puts the group winners in opposite halves and pairs each
 * runner-up against a different group's third, so nobody meets a fellow group
 * member in the first playoff round.
 *
 * When something blocks the playoff the server says what, and this shows it
 * verbatim instead of a disabled button with no explanation.
 */

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) return "Не удалось связаться с API.";
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Действие доступно организатору или инструктору.";
    if (error.status === 409) return "Плей-офф пока построить нельзя — проверьте список ниже.";
    return error.message;
  }
  return "Не удалось построить плей-офф.";
}

export function QualificationPanel({
  state,
  canManage = false,
  onGenerated,
}: {
  state: QualificationView;
  canManage?: boolean;
  onGenerated?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">Выход в плей-офф</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Победители подгрупп получают свободный проход, вторые и третьи бьются наперекрёст — так
          одногруппники не встречаются в первом круге.
        </p>
      </div>

      {state.blockers.length > 0 ? (
        <Alert tone="warning" title="Пока нельзя строить плей-офф">
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

      {state.qualifiers.length > 0 ? (
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {state.qualifiers.map((qualifier) => (
            <li
              key={qualifier.participant_id}
              className="flex items-center gap-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2"
            >
              <span className="font-record text-xs text-[var(--muted)]">{qualifier.seed}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {qualifier.display_name}
              </span>
              <Badge>
                {qualifier.group_name} · {qualifier.place_in_group} место
              </Badge>
            </li>
          ))}
        </ol>
      ) : null}

      {state.plan ? (
        <div className="space-y-3 border-t border-[var(--border)] pt-3">
          <PlanSummary plan={state.plan} />
          <CityVerdict plan={state.plan} />
          <PairPreview plan={state.plan} />
        </div>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {canManage ? (
        <div className="border-t border-[var(--border)] pt-3">
          <Button
            type="button"
            disabled={!state.ready || busy}
            icon={<Network className="size-3.5" strokeWidth={2.25} />}
            onClick={() => {
              setBusy(true);
              setError(null);
              void generatePlayoff(state.competition_id)
                .then(() => onGenerated?.())
                .catch((caught) => setError(describeError(caught)))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Строим сетку…" : "Построить плей-офф"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
