import { EmptyState, Table, Td, Th } from "@/components/ui";
import type { ParticipantView } from "@/types";

import { ParticipantStatusBadge } from "./badges";

export function ParticipantsTable({
  participants,
  showSeed = true,
}: {
  participants: ParticipantView[];
  showSeed?: boolean;
}) {
  if (participants.length === 0) {
    return (
      <EmptyState
        title="Участников пока нет"
        description="Как только организатор зарегистрирует спортсменов или команды, они появятся здесь."
      />
    );
  }

  return (
    <Table>
      <thead>
        <tr>
          {showSeed ? <Th align="center" className="w-16">№</Th> : null}
          <Th>Участник</Th>
          <Th className="w-32">Тип</Th>
          <Th className="w-52">Статус</Th>
        </tr>
      </thead>
      <tbody>
        {participants.map((participant) => (
          <tr key={participant.id}>
            {showSeed ? (
              <Td align="center" className="tabular-nums text-[var(--muted)]">
                {participant.seed ?? "—"}
              </Td>
            ) : null}
            <Td className="font-medium">{participant.display_name}</Td>
            <Td className="text-[var(--muted)]">
              {participant.type === "TEAM" ? "Команда" : "Спортсмен"}
            </Td>
            <Td>
              <ParticipantStatusBadge status={participant.status} />
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
