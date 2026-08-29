import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getBracket,
  getCompetition,
  getStandings,
  getTournament,
  listDraws,
  listEvents,
  listMatches,
  listParticipants,
  listTeams,
} from "@/api/tournaments";
import { Badge, Container, PageHeader } from "@/components/ui";
import { CompetitionStatusBadge } from "@/features/tournaments/badges";
import { CompetitionWorkspace } from "@/features/tournaments/competition-workspace";
import { competitionFormat, competitionType, drawType, labelOf } from "@/lib/labels";

type PageProps = { params: Promise<{ id: string; competitionId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { competitionId } = await params;
  const competition = await getCompetition(competitionId);
  return { title: competition?.name ?? "Дисциплина" };
}

export default async function CompetitionPage({ params }: PageProps) {
  const { id, competitionId } = await params;

  const [tournament, competition] = await Promise.all([
    getTournament(id),
    getCompetition(competitionId),
  ]);
  if (!competition || competition.tournament_id !== id) notFound();

  const [participants, teams, matches, standings, bracket, draws, events] = await Promise.all([
    listParticipants(competitionId),
    listTeams(competitionId),
    listMatches(competitionId),
    getStandings(competitionId),
    getBracket(competitionId),
    listDraws(competitionId),
    listEvents(competitionId),
  ]);

  return (
    <Container className="space-y-8 py-10">
      <PageHeader
        eyebrow={
          <Link href={`/tournaments/${id}`}>← {tournament?.title ?? "Турнир"}</Link>
        }
        title={competition.name}
        description={competition.description ?? undefined}
        actions={
          <>
            <Badge>{labelOf(competitionType, competition.type)}</Badge>
            <Badge tone="info">{labelOf(competitionFormat, competition.format)}</Badge>
            <CompetitionStatusBadge status={competition.status} />
          </>
        }
      />

      {draws.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
          <span>Жеребьёвка:</span>
          {draws.map((draw) => (
            <Badge key={draw.id}>
              {draw.name} · {labelOf(drawType, draw.type)}
            </Badge>
          ))}
        </div>
      ) : null}

      <CompetitionWorkspace
        data={{ competition, participants, teams, matches, standings, bracket, draws, events }}
      />
    </Container>
  );
}
