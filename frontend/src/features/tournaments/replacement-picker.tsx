"use client";

import { useEffect, useState } from "react";

import { getReplacementCandidates } from "@/api/tournaments";
import { Alert, Badge, cn } from "@/components/ui";
import type { ReplacementCandidate } from "@/types";

/**
 * Choosing who stands in for a fighter who is leaving the draw.
 *
 * The backend ranks the list — the fighter's own club first, then other
 * reserves, then everyone else entered — and this shows that order as it comes,
 * without re-sorting. Re-ranking here would mean two different answers to the
 * same question depending on which one the organizer happened to read.
 *
 * The suggestion is never an action. Nothing is seated until the surrounding
 * dialog is submitted, which is why loading this list is a plain read.
 */

const REASON_LABEL: Record<ReplacementCandidate["reason"], string> = {
  SAME_CLUB_RESERVE: "Запасной того же клуба",
  RESERVE: "Запасной",
  OTHER_COMPETITION: "Заявлен на турнир",
};

export function ReplacementPicker({
  participantId,
  value,
  onChange,
  disabled = false,
  /** The "nobody" option makes no sense once a walkover is being undone. */
  allowNone = true,
  noneLabel = "Без замены — бои отдать соперникам",
}: {
  participantId: string;
  value: string | null;
  onChange: (participantId: string | null) => void;
  disabled?: boolean;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const [candidates, setCandidates] = useState<ReplacementCandidate[] | null>(null);
  const [failed, setFailed] = useState(false);

  // No state is reset here on purpose: callers mount this keyed by the
  // participant, so a different fighter gets a fresh component rather than one
  // that has to unlearn the previous answer.
  useEffect(() => {
    let cancelled = false;
    getReplacementCandidates(participantId)
      .then((view) => {
        if (!cancelled) setCandidates(view.candidates);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [participantId]);

  if (failed) {
    return (
      <Alert tone="warning" title="Не удалось загрузить кандидатов">
        Замену можно указать позже — снятие от этого не зависит.
      </Alert>
    );
  }

  if (candidates === null) {
    return <p className="text-sm text-[var(--muted)]">Подбираем замену…</p>;
  }

  if (candidates.length === 0) {
    return (
      <Alert tone="info" title="Заменить некем">
        Ни запасных, ни свободных заявленных бойцов, подходящих по дисциплине.
      </Alert>
    );
  }

  return (
    <div role="radiogroup" aria-label="Замена" className="space-y-1.5">
      {allowNone ? (
        <Option
          active={value === null}
          disabled={disabled}
          onSelect={() => onChange(null)}
          title={noneLabel}
        />
      ) : null}

      {candidates.map((candidate) => (
        <Option
          key={candidate.participant_id}
          active={value === candidate.participant_id}
          disabled={disabled}
          onSelect={() => onChange(candidate.participant_id)}
          title={candidate.display_name}
          note={[REASON_LABEL[candidate.reason], candidate.club_name]
            .filter(Boolean)
            .join(" · ")}
          warning={
            candidate.busy_in.length > 0
              ? "Уже дерётся в другой дисциплине — возможна накладка по времени"
              : null
          }
        />
      ))}
    </div>
  );
}

function Option({
  active,
  disabled,
  onSelect,
  title,
  note,
  warning,
}: {
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
  title: string;
  note?: string;
  warning?: string | null;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors disabled:opacity-55",
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--border-strong)] text-[var(--muted)] hover:bg-[var(--surface-muted)]",
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      {note ? <span className="text-xs opacity-80">{note}</span> : null}
      {warning ? (
        <Badge tone="warning" className="ms-auto">
          {warning}
        </Badge>
      ) : null}
    </button>
  );
}
