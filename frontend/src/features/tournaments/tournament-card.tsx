import Link from "next/link";

import { Card } from "@/components/ui";
import { formatDateRange, formatPlace } from "@/lib/format";
import type { Tournament } from "@/types";

import { TournamentStatusBadge } from "./badges";

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  return (
    <Card as="li" className="transition-colors hover:border-[var(--accent)]">
      <Link href={`/tournaments/${tournament.id}`} className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-balance font-semibold leading-snug">{tournament.title}</h3>
          <TournamentStatusBadge status={tournament.status} />
        </div>

        {tournament.description ? (
          <p className="line-clamp-2 text-sm text-[var(--muted)]">{tournament.description}</p>
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
