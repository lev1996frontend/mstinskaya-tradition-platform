import type { Metadata } from "next";
import { Plus, Trophy } from "lucide-react";

import { listTournamentsWithStatus } from "@/api/tournaments";
import { ApiOfflineNotice } from "@/components/api-status";
import { ButtonLink, Container, EmptyState, PageHeader } from "@/components/ui";
import { TournamentGrid } from "@/features/home/tournament-grid";
import { DirectionalTransition } from "@/features/transitions/directional-transition";
import { WeaponDrawBillet } from "@/features/tournaments/weapon-draw-billet";
import { plural } from "@/lib/format";
import type { Tournament, TournamentStatus } from "@/types";

export const metadata: Metadata = {
  title: "Турниры",
  description: "Турниры Мстинской традиции: расписание, участники, сетки и результаты.",
};

/** Live before archived, and inside each group the newest event first. */
const STATUS_WEIGHT: Record<TournamentStatus, number> = {
  FINAL: 0,
  RUNNING: 0,
  ACTIVE: 0,
  BRACKET_CREATED: 1,
  READY: 1,
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
  const { items: tournaments, offline } = await listTournamentsWithStatus();
  const sorted = sortTournaments(tournaments);

  return (
    <DirectionalTransition>
      <Container className="space-y-8 py-10">
        <PageHeader
          eyebrow="Соревнования"
          title="Турниры"
          description="Полный список событий: от регистрации до итоговых результатов. Внутри каждого турнира — дисциплины с участниками, командами, сеткой и таблицей."
          actions={
            <ButtonLink href="/tournaments/new" icon={<Plus className="size-4" strokeWidth={2.5} />}>
              Создать турнир
            </ButtonLink>
          }
        />

        {sorted.length === 0 ? (
          <div className="space-y-4">
            {offline ? <ApiOfflineNotice /> : null}
            <EmptyState
              title="Турниров пока нет"
              icon={<Trophy className="size-5" strokeWidth={1.75} />}
              description="Список появится, как только организатор создаст первое событие."
            />
          </div>
        ) : (
          <>
            <p className="text-sm text-[var(--muted)]">
              {plural(sorted.length, "турнир", "турнира", "турниров")}
            </p>
            <TournamentGrid tournaments={sorted} />
          </>
        )}

        <WeaponDrawBillet />
      </Container>
    </DirectionalTransition>
  );
}
