"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Swords } from "lucide-react";
import { useMemo, useState } from "react";

import { updateMatchStatus } from "@/api/tournaments";
import { Alert, Badge, Button, Card, EmptyState, cn } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { labelOf, matchStage, resultMethod } from "@/lib/labels";
import { RESULT_METHOD_ICONS } from "@/lib/result-method-icons";
import type { MatchStatus, MatchView } from "@/types";

import { MatchStatusBadge } from "./badges";

type Filter = "ALL" | MatchStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "Все" },
  { key: "SCHEDULED", label: "Запланированы" },
  { key: "IN_PROGRESS", label: "Идут" },
  { key: "FINISHED", label: "Завершены" },
  { key: "CANCELLED", label: "Отменены" },
];

function Side({
  name,
  isWinner,
  hasWinner,
}: {
  name: string | null;
  isWinner: boolean;
  hasWinner: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {name ? (
        <Avatar name={name} size="xs" />
      ) : (
        <span
          aria-hidden="true"
          className="inline-block size-6 shrink-0 rounded-full border border-dashed border-[var(--border-strong)]"
        />
      )}
      <span
        className={cn(
          "truncate",
          !name && "italic text-[var(--muted)]",
          isWinner && "font-semibold text-[var(--accent)]",
          hasWinner && !isWinner && "text-[var(--muted)]",
        )}
      >
        {name ?? "не назначен"}
      </span>
    </span>
  );
}

export function MatchesList({
  matches,
  canManage,
  onEditResult,
  onChanged,
}: {
  matches: MatchView[];
  canManage: boolean;
  onEditResult: (match: MatchView) => void;
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const counts = useMemo(() => {
    const base: Record<string, number> = { ALL: matches.length };
    for (const match of matches) base[match.status] = (base[match.status] ?? 0) + 1;
    return base;
  }, [matches]);

  const visible = filter === "ALL" ? matches : matches.filter((m) => m.status === filter);

  async function start(match: MatchView) {
    setBusyId(match.id);
    setError(null);
    try {
      await updateMatchStatus(match.id, { status: "RUNNING" });
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof ApiUnreachableError
          ? "Не удалось связаться с API. Проверьте, что бэкенд запущен."
          : caught instanceof ApiError
            ? caught.message
            : "Не удалось изменить статус боя.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (matches.length === 0) {
    return (
      <EmptyState
        title="Боёв пока нет"
        icon={<Swords className="size-5" strokeWidth={1.75} />}
        description="Бои появятся после жеребьёвки и формирования сетки дисциплины."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр боёв">
        {FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              aria-pressed={active}
              className={cn(
                "relative rounded-[var(--radius-pill)] border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-transparent text-white"
                  : "border-[var(--border-strong)] text-[var(--muted)] hover:bg-[var(--surface-muted)]",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="match-filter-pill"
                  className="absolute inset-0 rounded-[var(--radius-pill)] bg-[var(--accent)]"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                />
              ) : null}
              <span className="relative">
                {item.label}
                <span className="ml-1.5 tabular-nums opacity-70">{counts[item.key] ?? 0}</span>
              </span>
            </button>
          );
        })}
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {visible.length === 0 ? (
        <EmptyState title="Нет боёв с таким статусом" />
      ) : (
        <ul className="space-y-3">
          {visible.map((match) => {
            const hasWinner = Boolean(match.winner_id);
            const isLive = match.status === "IN_PROGRESS";
            const MethodIcon = match.result ? RESULT_METHOD_ICONS[match.result.method] : null;
            return (
              <Card
                as="li"
                key={match.id}
                className={cn(
                  "p-4 transition-shadow",
                  isLive && "border-[var(--live)]/60 shadow-[var(--shadow-glow-accent)]",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Badge>{labelOf(matchStage, match.stage)}</Badge>
                  <MatchStatusBadge status={match.status} />
                  {match.result ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
                      {MethodIcon ? <MethodIcon className="size-3.5" strokeWidth={2} /> : null}
                      {labelOf(resultMethod, match.result.method)} ·{" "}
                      {formatDateTime(match.result.recorded_at)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
                  <Side
                    name={match.participant_a?.display_name ?? null}
                    isWinner={hasWinner && match.winner_id === match.participant_a?.id}
                    hasWinner={hasWinner}
                  />
                  <span className="text-xs uppercase tracking-wide text-[var(--muted)]">против</span>
                  <Side
                    name={match.participant_b?.display_name ?? null}
                    isWinner={hasWinner && match.winner_id === match.participant_b?.id}
                    hasWinner={hasWinner}
                  />
                </div>

                {match.result?.comment ? (
                  <p className="mt-3 border-t border-[var(--border)] pt-3 text-sm text-[var(--muted)]">
                    {match.result.comment}
                  </p>
                ) : null}

                {canManage ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                    {match.status === "SCHEDULED" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void start(match)}
                        disabled={busyId === match.id}
                      >
                        Начать бой
                      </Button>
                    ) : null}
                    {match.status !== "CANCELLED" ? (
                      <Button
                        variant={match.result ? "secondary" : "primary"}
                        size="sm"
                        onClick={() => onEditResult(match)}
                      >
                        {match.result ? "Изменить результат" : "Внести результат"}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </ul>
      )}

      {!canManage ? (
        <p className="text-xs text-[var(--muted)]">
          Внесение и изменение результатов доступно после входа в систему.
        </p>
      ) : null}
    </div>
  );
}
