import Link from "next/link";

import { listTournaments } from "@/api/tournaments";
import { ButtonLink, Card, Container } from "@/components/ui";
import { TournamentCard } from "@/features/tournaments/tournament-card";

const DIRECTIONS = [
  {
    href: "/tournaments",
    title: "Турниры",
    text: "Составы, сетки плей-офф, турнирные таблицы и результаты боёв.",
  },
  {
    href: "/rules",
    title: "Правила",
    text: "Версионированные регламенты и разделы правил с сохранением истории.",
  },
  {
    href: "/education",
    title: "Обучение",
    text: "Курсы, модули и уроки для спортсменов, инструкторов и судей.",
  },
  {
    href: "/athletes",
    title: "Спортсмены",
    text: "Профили участников сообщества, уровень подготовки и опыт.",
  },
  {
    href: "/clubs",
    title: "Клубы",
    text: "Клубы традиции, их география и состав участников.",
  },
];

export default async function HomePage() {
  const tournaments = await listTournaments();
  const upcoming = tournaments
    .filter((tournament) => tournament.status !== "ARCHIVED")
    .slice(0, 3);

  return (
    <>
      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <Container className="py-16 sm:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Цифровая платформа сообщества
          </p>
          <h1 className="mt-4 max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            Мстинская традиция
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
            Единое пространство для обучения, правил, судейства, клубов и соревнований. Турнирный
            модуль ведёт участников, команды, жеребьёвку, сетку и результаты — с полной историей
            изменений.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/tournaments">Смотреть турниры</ButtonLink>
            <ButtonLink href="/rules" variant="secondary">
              Правила и регламенты
            </ButtonLink>
          </div>
        </Container>
      </section>

      <Container className="space-y-16 py-12 sm:py-16">
        {upcoming.length > 0 ? (
          <section className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight">Ближайшие турниры</h2>
              <Link href="/tournaments" className="text-sm text-[var(--accent)] hover:underline">
                Все турниры →
              </Link>
            </div>
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((tournament) => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-5">
          <h2 className="text-xl font-semibold tracking-tight">Направления</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DIRECTIONS.map((item) => (
              <Card as="li" key={item.href} className="transition-colors hover:border-[var(--accent)]">
                <Link href={item.href} className="block p-5">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm text-[var(--muted)]">{item.text}</p>
                </Link>
              </Card>
            ))}
          </ul>
        </section>
      </Container>
    </>
  );
}
