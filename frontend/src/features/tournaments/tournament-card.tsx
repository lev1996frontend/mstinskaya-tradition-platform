import Link from "next/link";
import { ViewTransition } from "react";

import { Card, cn } from "@/components/ui";
import { formatDateRange, formatPlace } from "@/lib/format";
import type { Tournament } from "@/types";

import { TournamentStatusBadge } from "./badges";

export function TournamentCard({
  tournament,
  featured = false,
}: {
  tournament: Tournament;
  featured?: boolean;
}) {
  const href = `/tournaments/${tournament.id}`;

  return (
    <Card
      as="article"
      variant={featured ? "featured" : "default"}
      /* The same mark the discipline cards carry — see `.record-card` in
         globals.css. A border tint on its own was the whole hover here, which
         on a card this size is a change you find by accident rather than one
         that answers you. */
      className="record-card group h-full"
    >
      <Link
        href={href}
        transitionTypes={["nav-forward"]}
        className={cn(
          "flex h-full flex-col gap-3 p-5 transition-transform duration-300 group-hover:translate-x-1.5 group-focus-within:translate-x-1.5",
          featured && "sm:p-7",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <ViewTransition name={`tournament-title-${tournament.id}`} share="text-morph" default="none">
            <h3
              className={cn(
                "min-w-0 text-balance font-semibold leading-snug",
                featured && "font-display text-2xl",
              )}
            >
              {tournament.title}
            </h3>
          </ViewTransition>
          <TournamentStatusBadge status={tournament.status} />
        </div>

        {tournament.description ? (
          <p
            className={cn(
              "text-sm text-[var(--muted)]",
              featured ? "line-clamp-3" : "line-clamp-2",
            )}
          >
            {tournament.description}
          </p>
        ) : null}

        <dl className="mt-auto space-y-1 text-sm text-[var(--muted)]">
          <div className="flex gap-2">
            <dt className="sr-only">Даты</dt>
            <dd>{formatDateRange(tournament.start_date, tournament.end_date)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="sr-only">Место</dt>
            <dd className="truncate">
              {formatPlace(tournament.city, tournament.country, tournament.location)}
            </dd>
          </div>
        </dl>
      </Link>
    </Card>
  );
}
