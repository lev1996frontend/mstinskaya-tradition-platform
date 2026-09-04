import type { Metadata } from "next";
import { Layers } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";

import {
  getTournament,
  listCategories,
  listCompetitions,
  listDocuments,
  listRegistrations,
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
import { DirectionalTransition } from "@/features/transitions/directional-transition";
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
  const [tournament, competitions, categories, documents, registrations] = await Promise.all([
    getTournament(id),
    listCompetitions(id),
    listCategories(id),
    listDocuments(id),
    listRegistrations(id),
  ]);
  if (!tournament) notFound();

  return (
    <DirectionalTransition>
      <Container wide className="space-y-10 py-10">
        <PageHeader
          eyebrow={
            <Link href="/tournaments" className="label-link label-link-back" transitionTypes={["nav-back"]}>
              Все турниры
            </Link>
          }
          title={
            <ViewTransition name={`tournament-title-${tournament.id}`} share="text-morph" default="none">
              {tournament.title}
            </ViewTransition>
          }
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
                /* People, not entries: the list is one row per athlete *per
                   category*, so a fighter entered in both палка and нож is two
                   rows and one participant. */
                value: new Set(registrations.map((entry) => entry.athlete_id)).size,
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
              icon={<Layers className="size-5" strokeWidth={1.75} />}
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
                      <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        {/* An age bound is the difference between «Ветераны» and
                            the open absolute, so it belongs beside the name and
                            not buried inside the discipline. */}
                        {competition.age_label ? (
                          <Badge tone="info">{competition.age_label}</Badge>
                        ) : null}
                        <Badge>{labelOf(competitionType, competition.type)}</Badge>
                      </span>
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
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm transition-colors hover:border-[var(--accent)]"
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
    </DirectionalTransition>
  );
}
