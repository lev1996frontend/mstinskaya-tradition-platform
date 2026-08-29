import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getTournament,
  listCategories,
  listCompetitions,
  listDocuments,
  listParticipants,
} from "@/api/tournaments";
import {
  Badge,
  Card,
  Container,
  DefinitionList,
  EmptyState,
  PageHeader,
  Section,
} from "@/components/ui";
import { TournamentStatusBadge } from "@/features/tournaments/badges";
import { formatDateRange, formatPlace, plural } from "@/lib/format";
import { competitionFormat, competitionType, documentType, labelOf } from "@/lib/labels";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const tournament = await getTournament(id);
  return {
    title: tournament?.title ?? "Турнир",
    description: tournament?.description ?? undefined,
  };
}

export default async function TournamentPage({ params }: PageProps) {
  const { id } = await params;
  const tournament = await getTournament(id);
  if (!tournament) notFound();

  const [competitions, categories, documents, legacyParticipants] = await Promise.all([
    listCompetitions(id),
    listCategories(id),
    listDocuments(id),
    listParticipants(id),
  ]);

  return (
    <Container className="space-y-10 py-10">
      <PageHeader
        eyebrow={<Link href="/tournaments">← Все турниры</Link>}
        title={tournament.title}
        description={tournament.description ?? undefined}
        actions={<TournamentStatusBadge status={tournament.status} />}
      />

      <Card className="p-6">
        <DefinitionList
          items={[
            { term: "Даты", value: formatDateRange(tournament.start_date, tournament.end_date) },
            {
              term: "Место",
              value: formatPlace(tournament.city, tournament.country, tournament.location),
            },
            { term: "Дисциплин", value: competitions.length },
            {
              term: "Заявлено участников",
              value: legacyParticipants.length,
            },
          ]}
        />
      </Card>

      <Section
        title="Дисциплины"
        description="Отдельные виды программы внутри турнира. Внутри каждой — участники, команды, бои, таблица и сетка."
      >
        {competitions.length === 0 ? (
          <EmptyState
            title="Дисциплины ещё не заданы"
            description="Организатор пока не создал ни одной дисциплины для этого турнира."
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {competitions.map((competition) => (
              <Card
                as="li"
                key={competition.id}
                className="transition-colors hover:border-[var(--accent)]"
              >
                <Link
                  href={`/tournaments/${tournament.id}/competitions/${competition.id}`}
                  className="flex h-full flex-col gap-3 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 font-semibold leading-snug">{competition.name}</h3>
                    <Badge>{labelOf(competitionType, competition.type)}</Badge>
                  </div>
                  <p className="text-sm text-[var(--muted)]">
                    {labelOf(competitionFormat, competition.format)}
                  </p>
                  <p className="mt-auto text-sm text-[var(--muted)]">
                    {plural(competition.participant_count, "участник", "участника", "участников")} ·{" "}
                    {competition.finished_match_count} из {competition.match_count} боёв завершено
                  </p>
                </Link>
              </Card>
            ))}
          </ul>
        )}
      </Section>

      {categories.length > 0 ? (
        <Section title="Категории">
          <ul className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <li key={category.id}>
                <Badge>{category.name}</Badge>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {documents.length > 0 ? (
        <Section title="Документы">
          <ul className="space-y-2">
            {documents.map((document) => (
              <li key={document.id}>
                <a
                  href={document.file_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm hover:border-[var(--accent)]"
                >
                  <span className="truncate font-medium">{document.title}</span>
                  <Badge>{labelOf(documentType, document.type)}</Badge>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </Container>
  );
}
