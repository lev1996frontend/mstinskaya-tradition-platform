"use client";

import { Alert, Badge, EmptyState, cn } from "@/components/ui";
import { labelOf, matchStage, matchStatus, resultMethod } from "@/lib/labels";
import type { BracketTreeView, MatchView } from "@/types";

const ROUND_LABELS: Record<string, string> = {
  QUALIFICATION: "Квалификация",
  GROUP: "Групповой этап",
  QUARTERFINAL: "Четвертьфинал",
  SEMIFINAL: "Полуфинал",
  FINAL: "Финал",
};

function roundLabel(key: string, fallback: string): string {
  if (ROUND_LABELS[key]) return ROUND_LABELS[key];
  return /^\d+$/.test(key) ? `Раунд ${key}` : fallback;
}

function SlotRow({
  name,
  isWinner,
  isDecided,
}: {
  name: string | null;
  isWinner: boolean;
  isDecided: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2",
        isWinner && "bg-[var(--accent-soft)]",
      )}
    >
      <span
        className={cn(
          "truncate text-sm",
          !name && "italic text-[var(--muted)]",
          isWinner ? "font-semibold text-[var(--accent)]" : isDecided && "text-[var(--muted)]",
        )}
      >
        {name ?? "Ожидает соперника"}
      </span>
      {isWinner ? (
        <span aria-label="Победитель" className="shrink-0 text-xs text-[var(--accent)]">
          ▲
        </span>
      ) : null}
    </div>
  );
}

export function BracketMatchCard({
  match,
  onEdit,
  className,
}: {
  match: MatchView;
  onEdit?: (match: MatchView) => void;
  className?: string;
}) {
  const status = matchStatus[match.status] ?? { label: match.status, tone: "neutral" as const };
  const isDecided = Boolean(match.winner_id);

  return (
    <div
      className={cn(
        "w-60 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
        <span className="truncate text-xs text-[var(--muted)]">
          {labelOf(matchStage, match.stage)}
        </span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <div className="divide-y divide-[var(--border)]">
        <SlotRow
          name={match.participant_a?.display_name ?? null}
          isWinner={isDecided && match.winner_id === match.participant_a?.id}
          isDecided={isDecided}
        />
        <SlotRow
          name={match.participant_b?.display_name ?? null}
          isWinner={isDecided && match.winner_id === match.participant_b?.id}
          isDecided={isDecided}
        />
      </div>

      {match.result ? (
        <p className="border-t border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)]">
          {labelOf(resultMethod, match.result.method)}
        </p>
      ) : null}

      {onEdit ? (
        <div className="border-t border-[var(--border)] px-3 py-1.5">
          <button
            type="button"
            onClick={() => onEdit(match)}
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            {match.result ? "Изменить результат" : "Внести результат"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function BracketView({
  bracket,
  onEditMatch,
}: {
  bracket: BracketTreeView;
  onEditMatch?: (match: MatchView) => void;
}) {
  if (bracket.rounds.length === 0 && bracket.unassigned.length === 0) {
    return (
      <EmptyState
        title="Сетка ещё не построена"
        description="Сетка появится после жеребьёвки и создания боёв в дисциплине."
      />
    );
  }

  return (
    <div className="space-y-6">
      {bracket.rounds.length > 0 ? (
        <div className="scroll-x pb-2">
          {/* Each round is stretched to the same height so later rounds sit
              centred between their feeder pairs, giving the tree its shape. */}
          <div className="flex min-h-64 items-stretch gap-6">
            {bracket.rounds.map((round) => (
              <div key={round.key} className="flex flex-col">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {roundLabel(round.key, round.label)}
                </h3>
                <div className="flex flex-1 flex-col justify-around gap-4">
                  {round.matches.map((match) => (
                    <BracketMatchCard key={match.id} match={match} onEdit={onEditMatch} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {bracket.unassigned.length > 0 ? (
        <div className="space-y-3">
          <Alert tone="info" title="Бои вне сетки">
            Эти бои не привязаны к раунду сетки — например, ещё не распределены жеребьёвкой.
          </Alert>
          <div className="flex flex-wrap gap-4">
            {bracket.unassigned.map((match) => (
              <BracketMatchCard key={match.id} match={match} onEdit={onEditMatch} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
