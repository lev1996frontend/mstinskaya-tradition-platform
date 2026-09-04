"use client";

import { UserMinus, Users } from "lucide-react";
import { useState } from "react";

import { Button, EmptyState, Table, Td, Th } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import type { MatchView, ParticipantView } from "@/types";

import { ParticipantStatusBadge } from "./badges";
import { WithdrawDialog } from "./withdraw-dialog";

/** Statuses that mean the fighter is already out; nothing left to withdraw. */
const OUT_STATUSES = new Set(["WITHDRAWN", "DISQUALIFIED"]);

export function ParticipantsTable({
  participants,
  showSeed = true,
  canManage = false,
  matches = [],
  onChanged,
}: {
  participants: ParticipantView[];
  showSeed?: boolean;
  /**
   * Shows the withdraw control. The backend refuses the call regardless of
   * what the browser renders, so this only decides whether an organizer is
   * shown a button they can actually use.
   */
  canManage?: boolean;
  /** Used only to preview which bouts a withdrawal would hand over. */
  matches?: MatchView[];
  onChanged?: () => void;
}) {
  const [withdrawing, setWithdrawing] = useState<ParticipantView | null>(null);
  const showActions = canManage && Boolean(onChanged);
  if (participants.length === 0) {
    return (
      <EmptyState
        title="Участников пока нет"
        icon={<Users className="size-5" strokeWidth={1.75} />}
        description="Как только организатор зарегистрирует спортсменов или команды, они появятся здесь."
      />
    );
  }

  const table = (
    <Table>
      <thead>
        <tr>
          {showSeed ? <Th align="center" className="w-16">№</Th> : null}
          <Th>Участник</Th>
          <Th className="hidden w-32 sm:table-cell">Тип</Th>
          <Th className="w-52">Статус</Th>
          {showActions ? <Th className="w-32" align="right">Действия</Th> : null}
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
            {showActions ? (
              <Td align="right">
                {OUT_STATUSES.has(participant.status) ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<UserMinus className="size-3.5" strokeWidth={2} />}
                    onClick={() => setWithdrawing(participant)}
                  >
                    Снять
                  </Button>
                )}
              </Td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </Table>
  );

  return (
    <>
      {table}
      {withdrawing ? (
        <WithdrawDialog
          participant={withdrawing}
          matches={matches}
          onClose={() => setWithdrawing(null)}
          onSaved={() => {
            setWithdrawing(null);
            onChanged?.();
          }}
        />
      ) : null}
    </>
  );
}
