"use client";

import { ArrowDown, ArrowUp, Scale } from "lucide-react";
import { useState } from "react";

import { resolveGroupTie } from "@/api/tournaments";
import { Alert, Badge, Button, Card, Table, Td, Th, cn } from "@/components/ui";
import { Field, Textarea } from "@/components/ui/form";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import type { GroupStageView, GroupView, UnresolvedTieView } from "@/types";

/**
 * Group tables, and the ties they could not settle.
 *
 * Like the round-robin standings this deliberately shows counts only — no
 * points column, no invented placement. Where a place *is* shown it was
 * determined: by record, by the fighters' own bout, or by the organizer saying
 * so on the record. Anything else shows «—» and the tie is spelled out
 * underneath, because a place here decides who reaches the playoff.
 */

const RESOLVED_LABEL: Record<string, string> = {
  RECORD: "по победам",
  HEAD_TO_HEAD: "по личной встрече",
  MANUAL: "решением судей",
};

function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) return "Не удалось связаться с API.";
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Решение принимает организатор или инструктор.";
    return error.message;
  }
  return "Не удалось сохранить решение.";
}

function TieBreakForm({
  groupId,
  tie,
  onResolved,
}: {
  groupId: string;
  tie: UnresolvedTieView;
  onResolved: (stage: GroupStageView) => void;
}) {
  const [order, setOrder] = useState(
    tie.participant_ids.map((id, index) => ({ id, name: tie.participant_names[index] ?? "—" })),
  );
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    setOrder((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const trimmed = reason.trim();

  return (
    <div className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--border-strong)] p-3">
      <p className="text-sm">
        <Scale className="mr-1.5 inline size-3.5 align-[-2px]" strokeWidth={2} />
        {tie.reason}. Платформа не расставляет места сама — решите вручную и укажите причину.
      </p>
      <ol className="space-y-1">
        {order.map((row, index) => (
          <li
            key={row.id}
            className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] px-2.5 py-1.5"
          >
            <span className="font-record text-xs text-[var(--muted)]">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
            <button
              type="button"
              aria-label={`Поднять ${row.name}`}
              disabled={index === 0 || saving}
              onClick={() => move(index, -1)}
              className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface)] disabled:opacity-30"
            >
              <ArrowUp className="size-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label={`Опустить ${row.name}`}
              disabled={index === order.length - 1 || saving}
              onClick={() => move(index, 1)}
              className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface)] disabled:opacity-30"
            >
              <ArrowDown className="size-3.5" strokeWidth={2} />
            </button>
          </li>
        ))}
      </ol>

      <Field label="Причина" hint="Попадёт в журнал дисциплины — решение остаётся на записи">
        {(props) => (
          <Textarea
            {...props}
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={saving}
            placeholder="Решение судейской коллегии по качеству побед"
          />
        )}
      </Field>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Button
        type="button"
        size="sm"
        disabled={saving || trimmed.length < 3}
        onClick={() => {
          setSaving(true);
          setError(null);
          void resolveGroupTie(groupId, { ordering: order.map((row) => row.id), reason: trimmed })
            .then(onResolved)
            .catch((caught) => setError(describeError(caught)))
            .finally(() => setSaving(false));
        }}
      >
        {saving ? "Сохраняем…" : "Утвердить порядок"}
      </Button>
    </div>
  );
}

function GroupTable({
  group,
  canManage,
  onResolved,
}: {
  group: GroupView;
  canManage: boolean;
  onResolved: (stage: GroupStageView) => void;
}) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-display text-base font-semibold tracking-tight">{group.name}</h4>
        <span className="flex gap-1.5">
          <Badge>выходит {group.advance_count}</Badge>
          {group.decided ? (
            <Badge tone="success">определилась</Badge>
          ) : group.complete ? (
            <Badge tone="warning">есть равенство</Badge>
          ) : (
            <Badge tone="info">идёт</Badge>
          )}
        </span>
      </div>

      <Table>
        <thead>
          <tr>
            <Th align="center" className="w-12">
              №
            </Th>
            <Th>Боец</Th>
            <Th align="center" className="w-16">
              Боёв
            </Th>
            <Th align="center" className="w-16">
              Побед
            </Th>
            <Th align="center" className="w-20">
              Поражений
            </Th>
            <Th className="hidden w-36 sm:table-cell">Место определено</Th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => (
            <tr
              key={row.participant?.id ?? row.rank}
              className={cn(row.qualifies && "bg-[var(--accent-soft)]/40")}
            >
              <Td align="center" className="font-record text-[var(--muted)]">
                {row.rank ?? "—"}
              </Td>
              <Td className="font-medium">{row.participant?.display_name ?? "—"}</Td>
              <Td align="center" className="font-record">
                {row.played}
              </Td>
              <Td align="center" className="font-record">
                {row.wins}
              </Td>
              <Td align="center" className="font-record">
                {row.losses}
              </Td>
              <Td className="hidden text-xs text-[var(--muted)] sm:table-cell">
                {row.resolved_by ? RESOLVED_LABEL[row.resolved_by] : "—"}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {group.unresolved.map((tie) =>
        canManage ? (
          <TieBreakForm
            key={tie.participant_ids.join("-")}
            groupId={group.id}
            tie={tie}
            onResolved={onResolved}
          />
        ) : (
          <Alert key={tie.participant_ids.join("-")} tone="warning" title="Места не определены">
            {tie.participant_names.join(", ")} — {tie.reason}. Решение примет судейская коллегия.
          </Alert>
        ),
      )}
    </Card>
  );
}

export function GroupStandings({
  stage,
  canManage = false,
  onChanged,
}: {
  stage: GroupStageView;
  canManage?: boolean;
  onChanged?: () => void;
}) {
  const [current, setCurrent] = useState(stage);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Сыграно боёв: {current.matches_finished} из {current.matches_total}. Только счёт побед —
        очков и мест платформа не придумывает.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {current.groups.map((group) => (
          <GroupTable
            key={group.id}
            group={group}
            canManage={canManage}
            onResolved={(updated) => {
              setCurrent(updated);
              onChanged?.();
            }}
          />
        ))}
      </div>
    </div>
  );
}
