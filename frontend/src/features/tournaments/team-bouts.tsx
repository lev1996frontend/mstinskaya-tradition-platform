"use client";

import { Users } from "lucide-react";
import { useState } from "react";

import { generateTeamBouts, recordTeamPairingResult } from "@/api/tournaments";
import { Alert, Badge, Button, Card, EmptyState, cn } from "@/components/ui";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import type { TeamBoutView } from "@/types";

/**
 * «Трое на трое» — the team phase.
 *
 * A team meeting is three individual pairings, and the team result is their
 * aggregate, recomputed by the backend after every pairing. A pairing is won by
 * pinning the opponent and signalling a finishing blow, so it draws no weapon
 * lot and runs no соступ — those belong to the individual поединок.
 */

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) return "Не удалось связаться с API.";
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Действие доступно организатору или инструктору.";
    if (error.status === 409) return "Командные встречи уже созданы.";
    if (error.status === 400) return error.message;
    return error.message;
  }
  return "Не удалось выполнить действие.";
}

function ScoreBar({ bout }: { bout: TeamBoutView }) {
  const decided = bout.wins_red + bout.wins_blue;
  return (
    <div className="flex items-center gap-3">
      <span className="font-display text-2xl font-semibold tabular-nums">
        {bout.wins_red}
        <span className="mx-1 text-[var(--muted)]">:</span>
        {bout.wins_blue}
      </span>
      <span className="text-xs text-[var(--muted)]">
        {decided} из {bout.pairings.length} схваток
      </span>
    </div>
  );
}

export function TeamBouts({
  competitionId,
  bouts,
  canManage,
  onChanged,
}: {
  competitionId: string;
  bouts: TeamBoutView[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  if (bouts.length === 0) {
    return (
      <div className="space-y-3">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <EmptyState
          title="Командные встречи не созданы"
          icon={<Users className="size-5" strokeWidth={1.75} />}
          description="Круговая система «трое на трое»: каждая команда встречается с каждой, в команде — трое бойцов."
          action={
            canManage ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void run(() => generateTeamBouts(competitionId))}
              >
                {busy ? "Создаём…" : "Создать круговые встречи"}
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {bouts.map((bout) => {
        const redWon = bout.winner_team_id === bout.team_red_id;
        const blueWon = bout.winner_team_id === bout.team_blue_id;
        return (
          <Card key={bout.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display truncate text-base font-semibold tracking-tight">
                  <span className={cn(redWon && "text-[var(--accent)]")}>{bout.team_red_name}</span>
                  <span className="mx-2 text-[var(--muted)]">—</span>
                  <span className={cn(blueWon && "text-[var(--accent)]")}>{bout.team_blue_name}</span>
                </p>
                <ScoreBar bout={bout} />
              </div>
              <Badge tone={bout.status === "FINISHED" ? "success" : bout.status === "IN_PROGRESS" ? "active" : "neutral"}>
                {bout.status === "FINISHED"
                  ? bout.winner_team_id
                    ? "Завершена"
                    : "Ничья"
                  : bout.status === "IN_PROGRESS"
                    ? "Идёт"
                    : "Запланирована"}
              </Badge>
            </div>

            <ul className="space-y-1.5 border-t border-[var(--border)] pt-3">
              {bout.pairings.map((pairing, index) => (
                <li
                  key={pairing.id}
                  className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <span className="font-display w-5 shrink-0 tabular-nums text-[var(--muted)]">
                    {index + 1}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      pairing.winner_id === pairing.participant_a?.id && "font-semibold text-[var(--accent)]",
                    )}
                  >
                    {pairing.participant_a?.display_name ?? "—"}
                  </span>
                  <span className="shrink-0 text-[var(--muted)]">—</span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      pairing.winner_id === pairing.participant_b?.id && "font-semibold text-[var(--accent)]",
                    )}
                  >
                    {pairing.participant_b?.display_name ?? "—"}
                  </span>

                  {pairing.status === "FINISHED" ? (
                    <Badge tone="success">Удержание и добивание</Badge>
                  ) : canManage ? (
                    <span className="flex shrink-0 gap-1.5">
                      {[pairing.participant_a, pairing.participant_b].map((side) =>
                        side ? (
                          <Button
                            key={side.id}
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              void run(() =>
                                recordTeamPairingResult(pairing.id, {
                                  winner_participant_id: side.id,
                                }),
                              )
                            }
                          >
                            Победа: {side.display_name}
                          </Button>
                        ) : null,
                      )}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
