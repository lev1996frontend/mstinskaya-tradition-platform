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
import { listRuleSets } from "@/api/catalog";
import {
  Badge,
  Card,
  Container,
  DefinitionList,
  EmptyState,
  PageHeader,
  Section,
} from "@/components/ui";
import { BackLink } from "@/components/brand/back-link";
import { TournamentDocumentsPanel } from "@/features/documents/document-upload";
import { TournamentRulesetPicker } from "@/features/tournaments/tournament-ruleset-picker";
import { TournamentStatusBadge } from "@/features/tournaments/badges";
import { TournamentIntake } from "@/features/tournaments/tournament-intake";
import { DirectionalTransition } from "@/features/transitions/directional-transition";
import { formatDateRange, formatPlace, plural } from "@/lib/format";
import { competitionFormat, competitionType, labelOf } from "@/lib/labels";
import { routes } from "@/lib/routes";

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
  const [tournament, competitions, categories, documents, registrations, ruleSets] = await Promise.all([
    getTournament(id),
    listCompetitions(id),
    listCategories(id),
    listDocuments(id),
    listRegistrations(id),
    listRuleSets(),
  ]);
  if (!tournament) notFound();

  return (
    <DirectionalTransition>
      <Container wide className="space-y-10 pt-10 pb-5">
        <PageHeader
          eyebrow={
            <BackLink href={routes.tournaments()} transitionTypes={["nav-back"]}>
              Все турниры
            </BackLink>
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
                  {/* The card itself carries the hover (`.record-card`'s own
                      lift) — this used to also nudge the content 6px right,
                      which read as two different things moving in two
                      different directions at once. */}
                  <Link
                    href={routes.competition(tournament.id, competition.id)}
                    /* One row on a wide card, not a column: a full-width card
                       with everything stacked left three lines tall reads as
                       broken layout — a wall of empty space to the right of
                       each short line. Splitting name+badges from the meta
                       and pushing them to opposite ends fills that width
                       instead of wasting it, and `flex-wrap` folds it back
                       into a stack once the card narrows below what one row
                       needs. */
                    className="flex h-full flex-wrap items-start justify-between gap-x-4 gap-y-2 p-5"
                  >
                    <div className="flex min-w-0 flex-wrap items-start gap-3">
                      <h3 className="min-w-0 font-semibold leading-snug">{competition.name}</h3>
                      <span className="flex shrink-0 flex-wrap gap-1.5">
                        {/* An age bound is the difference between «Ветераны» and
                            the open absolute, so it belongs beside the name and
                            not buried inside the discipline. */}
                        {competition.age_label ? (
                          <Badge tone="info">{competition.age_label}</Badge>
                        ) : null}
                        <Badge>{labelOf(competitionType, competition.type)}</Badge>
                      </span>
                    </div>
                    <p className="flex flex-wrap gap-x-1.5 text-sm text-[var(--muted)]">
                      <span>{labelOf(competitionFormat, competition.format)}</span>
                      <span aria-hidden>·</span>
                      <span>
                        {plural(competition.participant_count, "участник", "участника", "участников")}
                      </span>
                      <span aria-hidden>·</span>
                      <span>
                        {competition.finished_match_count} из {competition.match_count} боёв завершено
                      </span>
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

        {/* Two distinct sub-blocks, not one flat pile: the ruleset is a
            single edition this tournament points at — picked here, but only
            ever edited/attached on its own `/rules/{id}` page — while
            "Документы турнира" is a read-only list of whatever's already
            attached (положение and the like). Rendering them under one
            shared label made it look like the tournament's own upload button
            could replace the регламент itself, which it never could (see
            `TournamentDocumentsPanel`'s own `RULES`-type exclusion).
            `TournamentDocumentsPanel` deliberately has no upload form of its
            own any more — see its own doc comment for why and for the gap
            that leaves — so only the ruleset picker offers a signed-in
            manager anything to change here; the document list is public and
            identical for every visitor. */}
        <Section title="Документы">
          <div className="space-y-3">
            <p className="record-label text-[var(--chrome-muted)]">Регламент</p>
            <TournamentRulesetPicker
              tournamentId={tournament.id}
              ruleSets={ruleSets}
              currentRulesetId={tournament.ruleset_id}
            />
          </div>
          <div className="border-t border-[var(--border)] pt-4">
            <TournamentDocumentsPanel
              tournamentId={tournament.id}
              initialDocuments={documents}
              label="Документы турнира"
            />
          </div>
        </Section>
      </Container>
    </DirectionalTransition>
  );
}
