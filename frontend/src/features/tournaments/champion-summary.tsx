"use client";

import { Trophy } from "lucide-react";

import { CornerMark } from "@/components/brand/corner-mark";
import { Badge, Card, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { labelOf, matchStage } from "@/lib/labels";
import type { ChampionSummaryView } from "@/types";

import { WeaponMark } from "./weapon-mark";

/**
 * The tournament result.
 *
 * Everything shown is a recorded fact: the champion's path is the real chain of
 * their bouts, and each weapon is the lot that was actually drawn (or the
 * final's fixed weapon). No aggregate is invented — where nothing was recorded,
 * nothing is displayed.
 */
export function ChampionSummary({ summary }: { summary: ChampionSummaryView | null }) {
  if (!summary || !summary.complete || !summary.champion) {
    return (
      <EmptyState
        title="Турнир ещё не завершён"
        icon={<Trophy className="size-5" strokeWidth={1.75} />}
        description="Итоги появятся сразу после финального поединка — до этого чемпион не объявляется."
      />
    );
  }

  const { champion, path } = summary;

  return (
    <div className="space-y-4">
      <Card variant="featured" className="relative overflow-hidden p-6">
        <CornerMark className="absolute right-3 top-3 text-[var(--gold)]" size={18} />
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar name={champion.display_name} size="lg" />
          <div className="min-w-0">
            <p className="record-label text-[var(--iron-muted)]">Чемпион</p>
            <h3 className="font-display mt-1 text-2xl font-semibold tracking-tight">
              {champion.display_name}
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {[champion.city, champion.seed ? `посев ${champion.seed}` : null]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        <h4 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Путь по сетке
        </h4>
        {path.map((entry) => (
          <div
            key={entry.match_id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
          >
            <span className="w-32 shrink-0 text-sm font-medium">
              {labelOf(matchStage, entry.stage)}
            </span>
            {entry.is_bye ? (
              <Badge tone="info">Свободный проход</Badge>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--muted)]">
                  против{" "}
                  <span className="text-[var(--foreground)]">
                    {entry.opponent?.display_name ?? "—"}
                  </span>
                  {entry.opponent?.city ? ` · ${entry.opponent.city}` : ""}
                </span>
                {entry.weapon ? (
                  <WeaponMark weapon={entry.weapon} size={16} />
                ) : null}
                {entry.rounds_won > 0 ? (
                  <span className="font-display shrink-0 text-xs tabular-nums text-[var(--muted)]">
                    {entry.rounds_won} соступ.
                  </span>
                ) : null}
              </>
            )}
            {entry.won ? <Badge tone="success">Победа</Badge> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
