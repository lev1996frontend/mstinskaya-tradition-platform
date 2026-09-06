import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAthlete } from "@/api/catalog";
import { listAthleteTournamentHistory } from "@/api/tournaments";
import { Container, Section } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { AthleteHistory } from "@/features/tournaments/athlete-history";
import { athleteName } from "@/lib/athlete-name";
import { plural } from "@/lib/format";
import { athleteLevel, labelOf } from "@/lib/labels";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const athlete = await getAthlete(id);
  return { title: athlete ? athleteName(athlete, "Спортсмен") : "Спортсмен" };
}

export default async function AthletePage({ params }: PageProps) {
  const { id } = await params;
  const [athlete, history] = await Promise.all([getAthlete(id), listAthleteTournamentHistory(id)]);
  if (!athlete) notFound();

  return (
    <Container className="max-w-3xl space-y-8 py-10">
      <Link href="/athletes" className="record-label label-link label-link-back text-[var(--accent)]">
        Все спортсмены
      </Link>

      {/* Dossier masthead: the photo mounted on paper like an ID card, name
          and stamped facts issued as one record rather than a title over a
          separate facts card below it. */}
      <div className="rule-double-b flex flex-col gap-5 pb-6 sm:flex-row sm:items-center">
        <span className="inline-flex shrink-0 rounded-[var(--radius-md)] bg-[var(--surface-paper)] p-3">
          <Avatar name={athleteName(athlete, "?")} photoUrl={athlete.photo_url} size="lg" />
        </span>
        <div className="min-w-0 space-y-3">
          {/* The драковое имя is the headline where there is one, and it's
              labelled as such: it isn't a handle or a shortened surname but a
              name earned in a fight, worn so death would take longer to find
              you. Where there isn't one the ФИО takes the line and the label
              says so — the masthead used to keep the драковое-имя label over
              "Профиль спортсмена", which named nobody and mislabelled it into
              the bargain. */}
          <span className="record-label block text-[var(--chrome-muted)]">
            {athlete.nickname ? "Драковое имя" : "Имя"}
          </span>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {athleteName(athlete, "Профиль спортсмена")}
          </h1>
          {/* The ФИО below the драковое имя, never instead of it. */}
          {athlete.nickname && athlete.full_name ? (
            <p className="text-sm text-[var(--muted)]">{athlete.full_name}</p>
          ) : null}
          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            <div>
              <dt className="record-label text-[var(--chrome-muted)]">Уровень</dt>
              <dd className="font-record mt-0.5 text-sm">{labelOf(athleteLevel, athlete.level)}</dd>
            </div>
            <div>
              <dt className="record-label text-[var(--chrome-muted)]">Опыт</dt>
              <dd className="font-record mt-0.5 text-sm">
                {plural(athlete.experience_years, "год", "года", "лет")}
              </dd>
            </div>
            <div>
              <dt className="record-label text-[var(--chrome-muted)]">Год рождения</dt>
              <dd className="font-record mt-0.5 text-sm">{athlete.birth_year ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </div>

      {athlete.bio ? (
        <div className="ledger-lines space-y-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-4 py-4">
          <h2 className="record-label text-[var(--chrome-muted)]">О себе</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed">{athlete.bio}</p>
        </div>
      ) : null}

      <Section title="Турниры" description="Дисциплины, в которых спортсмен был заявлен участником.">
        <AthleteHistory history={history} />
      </Section>
    </Container>
  );
}
