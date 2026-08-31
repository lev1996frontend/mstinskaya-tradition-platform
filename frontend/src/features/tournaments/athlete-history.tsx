import { ScrollText } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui";
import { competitionFormat, labelOf, matchStage } from "@/lib/labels";
import type { AthleteParticipationView } from "@/types";

import { AthleteOutcomeBadge } from "./badges";

/**
 * An athlete's competition history, for their profile page.
 *
 * Every line is a fact read off recorded matches — champion, finalist, the
 * stage a run ended at, or the round-robin win/loss count. There is
 * deliberately no place column: the platform has no bronze match and no
 * confirmed tie-break rules, so it never states a numeric rank it didn't
 * compute (see `AthleteParticipationView`).
 */
export function AthleteHistory({ history }: { history: AthleteParticipationView[] }) {
  if (history.length === 0) {
    return (
      <EmptyState
        title="Пока нет турниров"
        icon={<ScrollText className="size-5" strokeWidth={1.75} />}
        description="Как только организатор внесёт этого спортсмена в состав дисциплины, турнир появится здесь."
      />
    );
  }

  return (
    <ul className="border-t-2 border-[var(--rule)]">
      {history.map((entry) => (
        <li key={entry.participant_id}>
          <Link
            href={`/tournaments/${entry.tournament_id}/competitions/${entry.competition_id}`}
            className="group flex flex-col gap-2 border-b border-[var(--border)] py-4 transition-[border-color,transform] hover:translate-x-0.5 hover:border-b-[var(--accent)] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-medium">
                {entry.outcome === "CHAMPION" ? (
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full bg-[var(--accent)]"
                  />
                ) : null}
                {entry.tournament_title}
              </p>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                {entry.competition_name} · {labelOf(competitionFormat, entry.format)}
                {entry.city ? ` · ${entry.city}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
              {entry.outcome === "ELIMINATED" && entry.eliminated_at_stage ? (
                <span>{labelOf(matchStage, entry.eliminated_at_stage)}</span>
              ) : null}
              {entry.outcome === "STANDINGS" && entry.standings_wins !== null ? (
                <span className="font-record">
                  {entry.standings_wins}П–{entry.standings_losses}П
                  {entry.standings_provisional ? " · предварительно" : ""}
                </span>
              ) : null}
              <AthleteOutcomeBadge outcome={entry.outcome} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
