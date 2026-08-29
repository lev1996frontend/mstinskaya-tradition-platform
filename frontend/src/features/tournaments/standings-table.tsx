import { Alert, EmptyState, Table, Td, Th } from "@/components/ui";
import type { StandingsView } from "@/types";

/**
 * Round-robin table. Deliberately shows counts only — no points column and no
 * official placement, because the rating and tie-break rules are unconfirmed
 * (docs/domain-model.md §5). Ties are marked instead of being broken silently.
 */
export function StandingsTable({ standings }: { standings: StandingsView }) {
  if (standings.rows.length === 0) {
    return (
      <EmptyState
        title="Таблица пуста"
        description="Таблица заполняется по мере регистрации участников и внесения результатов боёв."
      />
    );
  }

  const hasTies = standings.rows.some((row) => row.tied_with_previous);

  return (
    <div className="space-y-4">
      <Table>
        <thead>
          <tr>
            <Th align="center" className="w-14">
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
            <Th align="center" className="w-28">
              Без победителя
            </Th>
            <Th align="center" className="w-28">
              Не сыграно
            </Th>
          </tr>
        </thead>
        <tbody>
          {standings.rows.map((row) => (
            <tr key={row.participant.id}>
              <Td align="center" className="tabular-nums text-[var(--muted)]">
                {row.tied_with_previous ? "=" : row.position}
              </Td>
              <Td className="font-medium">
                {row.participant.display_name}
                {row.participant.status !== "REGISTERED" &&
                row.participant.status !== "APPROVED" &&
                row.participant.status !== "CONFIRMED" ? (
                  <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                    {row.participant.status === "WITHDRAWN"
                      ? "снялся"
                      : row.participant.status === "DISQUALIFIED"
                        ? "дисквалифицирован"
                        : ""}
                  </span>
                ) : null}
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
              <Td align="center" className="tabular-nums text-[var(--muted)]">
                {row.draws}
              </Td>
              <Td align="center" className="tabular-nums text-[var(--muted)]">
                {row.no_results}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

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
            Позиции со знаком «=» имеют одинаковое число побед и поражений. Итоговое место
            определяется судейской коллегией по официальному регламенту — платформа не применяет
            собственных правил распределения мест.
          </Alert>
        ) : null}
      </div>
    </div>
  );
}
