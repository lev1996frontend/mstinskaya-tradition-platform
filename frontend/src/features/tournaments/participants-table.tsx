import { Users } from "lucide-react";

import { EmptyState, Table, Td, Th } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
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
        icon={<Users className="size-5" strokeWidth={1.75} />}
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
          <Th className="hidden w-32 sm:table-cell">Тип</Th>
          <Th className="w-52">Статус</Th>
        </tr>
      </thead>
      <tbody>
        {participants.map((participant, index) => (
          <tr
            key={participant.id}
            className={index < 8 ? "step-in" : undefined}
            style={index < 8 ? { animationDelay: `${index * 40}ms` } : undefined}
          >
            {showSeed ? (
              <Td align="center" className="font-record text-[var(--muted)]">
                {participant.seed ?? "—"}
              </Td>
            ) : null}
            <Td className="font-medium">
              <div className="flex items-center gap-2.5">
                <Avatar name={participant.display_name} size="xs" />
                <span className="min-w-0 truncate">{participant.display_name}</span>
              </div>
            </Td>
            <Td className="hidden text-[var(--muted)] sm:table-cell">
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
