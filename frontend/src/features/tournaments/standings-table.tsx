import { ListOrdered } from "lucide-react";

import { Alert, EmptyState, Td, Th, cn } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import type { StandingsView } from "@/types";

import { ParticipantStatusBadge } from "./badges";

/**
 * Round-robin table. Deliberately shows counts only — no points column and no
 * official placement, because the rating and tie-break rules are unconfirmed
 * (docs/domain-model.md §5). Ties are marked instead of being broken silently:
 * a tied row shows a connecting tick instead of a definitive number, so the
 * platform never implies an order it didn't compute.
 */
export function StandingsTable({ standings }: { standings: StandingsView }) {
  if (standings.rows.length === 0) {
    return (
      <EmptyState
        title="Таблица пуста"
        icon={<ListOrdered className="size-5" strokeWidth={1.75} />}
        description="Таблица заполняется по мере регистрации участников и внесения результатов боёв."
      />
    );
  }

  const hasTies = standings.rows.some((row) => row.tied_with_previous);

  return (
    <div className="space-y-4">
      <div className="scroll-x max-h-[34rem] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full min-w-[22rem] border-collapse text-sm sm:min-w-[36rem]">
          <thead className="sticky top-0 z-10 bg-[var(--surface)]">
            <tr>
              <Th align="center" className="w-16">
                #
              </Th>
              <Th>Участник</Th>
              <Th align="center" className="w-20">
                Боёв
              </Th>
              <Th align="center" className="w-20">
                Побед
              </Th>
              <Th align="center" className="w-24">
                Поражений
              </Th>
              <Th align="center" className="hidden w-28 sm:table-cell">
                Без победителя
              </Th>
              <Th align="center" className="hidden w-28 sm:table-cell">
                Не сыграно
              </Th>
            </tr>
          </thead>
          <tbody>
            {standings.rows.map((row) => {
              const isLeader = row.position === 1 && !row.tied_with_previous;
              return (
                <tr
                  key={row.participant.id}
                  className={cn(isLeader && "bg-[var(--accent-soft)]/50")}
                >
                  <Td align="center" className="p-0">
                    <div className="flex h-full items-center justify-center py-3">
                      {row.tied_with_previous ? (
                        <span
                          aria-label="Равный результат с участником выше"
                          className="relative flex h-8 w-5 items-center justify-center"
                        >
                          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--gold)]" />
                          <span className="relative bg-[var(--surface)] px-1 text-sm font-medium text-[var(--gold-strong)]">
                            =
                          </span>
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "font-record text-lg font-semibold",
                            isLeader && "text-[var(--accent)]",
                          )}
                        >
                          {row.position}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td className="font-medium">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={row.participant.display_name} size="xs" />
                      <span className="min-w-0 truncate">{row.participant.display_name}</span>
                      {row.participant.status === "WITHDRAWN" ||
                      row.participant.status === "DISQUALIFIED" ? (
                        <ParticipantStatusBadge status={row.participant.status} />
                      ) : null}
                    </div>
                  </Td>
                  <Td align="center" className="tabular-nums">
                    {row.played}
                  </Td>
                  <Td align="center" className="tabular-nums font-semibold">
                    {row.wins}
                  </Td>
                  <Td align="center" className="tabular-nums">
                    {row.losses}
                  </Td>
                  <Td align="center" className="hidden tabular-nums text-[var(--muted)] sm:table-cell">
                    {row.draws}
                  </Td>
                  <Td align="center" className="hidden tabular-nums text-[var(--muted)] sm:table-cell">
                    {row.no_results}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-[var(--muted)]">
          Внесено результатов: {standings.matches_finished} из {standings.matches_total}.
        </p>
        {standings.provisional ? (
          <Alert tone="warning" title="Предварительная таблица">
            Не все бои завершены, порядок мест может измениться.
          </Alert>
        ) : null}
        {hasTies ? (
          <Alert tone="info" title="Есть равные показатели">
            Позиции, отмеченные тонкой линией, имеют одинаковое число побед и поражений. Итоговое
            место определяется судейской коллегией по официальному регламенту — платформа не
            применяет собственных правил распределения мест.
          </Alert>
        ) : null}
      </div>
    </div>
  );
}
