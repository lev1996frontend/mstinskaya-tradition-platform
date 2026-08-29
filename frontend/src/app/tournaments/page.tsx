import type { Metadata } from "next";

import { listTournaments } from "@/api/tournaments";
import { ApiOfflineNotice } from "@/components/api-status";
import { Container, EmptyState, PageHeader } from "@/components/ui";
import { TournamentCard } from "@/features/tournaments/tournament-card";
import { plural } from "@/lib/format";
import type { Tournament, TournamentStatus } from "@/types";

export const metadata: Metadata = {
  title: "Турниры",
  description: "Турниры Мстинской традиции: расписание, участники, сетки и результаты.",
};

/** Live before archived, and inside each group the newest event first. */
const STATUS_WEIGHT: Record<TournamentStatus, number> = {
  RUNNING: 0,
  ACTIVE: 0,
  REGISTRATION: 1,
  DRAFT: 2,
  FINISHED: 3,
  ARCHIVED: 4,
};

function sortTournaments(tournaments: Tournament[]): Tournament[] {
  return [...tournaments].sort((left, right) => {
    const weight = (STATUS_WEIGHT[left.status] ?? 9) - (STATUS_WEIGHT[right.status] ?? 9);
    if (weight !== 0) return weight;
    const leftDate = left.start_date ? Date.parse(left.start_date) : 0;
    const rightDate = right.start_date ? Date.parse(right.start_date) : 0;
    return rightDate - leftDate;
  });
}

export default async function TournamentsPage() {
  const tournaments = await listTournaments();
  const sorted = sortTournaments(tournaments);

  return (
    <Container className="space-y-8 py-10">
      <PageHeader
        eyebrow="Соревнования"
        title="Турниры"
        description="Полный список событий: от регистрации до итоговых результатов. Внутри каждого турнира — дисциплины с участниками, командами, сеткой и таблицей."
      />

      {sorted.length === 0 ? (
        <div className="space-y-4">
          <ApiOfflineNotice />
          <EmptyState
            title="Турниров пока нет"
            description="Список появится, как только организатор создаст первое событие."
          />
        </div>
      ) : (
        <>
          <p className="text-sm text-[var(--muted)]">
            {plural(sorted.length, "турнир", "турнира", "турниров")}
          </p>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sorted.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </ul>
        </>
      )}
    </Container>
  );
}
