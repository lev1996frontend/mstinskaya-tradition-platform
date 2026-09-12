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
import { TournamentDocumentsPanel } from "@/features/documents/document-upload";
import { TournamentStatusBadge } from "@/features/tournaments/badges";
import { TournamentIntake } from "@/features/tournaments/tournament-intake";
import { DirectionalTransition } from "@/features/transitions/directional-transition";
import { formatDateRange, formatPlace, plural } from "@/lib/format";
import { competitionFormat, competitionType, labelOf } from "@/lib/labels";

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
            /* Tracks that fit themselves to how many disciplines there are,
               rather than a fixed two columns: a tournament with one discipline
               used to leave half the row empty, which reads as a layout that
               broke rather than a list with one item in it. `auto-fit` collapses
               the empty tracks, so one card fills the width, two split it, and
               three or more wrap into as many columns as 24rem each will allow.

               `min(100%, 24rem)` rather than a bare `24rem`: below 384px the
               track would otherwise stay 384px wide and push the page into a
               horizontal scroll — the one thing a narrow phone must never do. */
            <ul className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr))]">
              {competitions.map((competition) => (
                <Card
                  as="li"
                  key={competition.id}
                  /* `group` so the name can answer the card's own hover — see
                     `.record-card` in globals.css for the rule that draws
                     along the bottom edge and the ring inside the border. */
                  className="record-card group"
                >
                  {/* The whole card's contents move, not the name alone. The
                      nudge is the mobile menu's own gesture, but applied to one
                      line inside a card it read as a broken hover — a title
                      sliding out from under text that stayed put. Either
                      everything travels or nothing does. */}
                  <Link
                    href={`/tournaments/${tournament.id}/competitions/${competition.id}`}
                    className="flex h-full flex-col gap-3 p-5 transition-transform duration-300 group-hover:translate-x-1.5 group-focus-within:translate-x-1.5"
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

          {/* Бланк открыт для всех: его обычно заполняет тренер клуба, а он не
              организатор и чаще всего вообще не залогинен. Второй лист бланка
              перечисляет дисциплины этого турнира с возрастными границами — без
              них колонка «Категория» заполняется наугад, поэтому ни бланка, ни
              загрузки нет, пока нет дисциплин. */}
          {competitions.length > 0 ? (
            <div className="mt-5 border-t border-[var(--border)] pt-5">
              <TournamentIntake tournamentId={tournament.id} />
            </div>
          ) : null}
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

        {/* Always shown, not just when there is already a document: a manager
            needs somewhere to attach the first положение too. The panel
            itself decides what an anonymous visitor sees (the public list
            only) versus a signed-in one (the list, a remove cross, and the
            upload form) — the same split `TournamentIntake` makes above. */}
        <Section title="Документы">
          <TournamentDocumentsPanel tournamentId={tournament.id} initialDocuments={documents} />
        </Section>
      </Container>
    </DirectionalTransition>
  );
}
