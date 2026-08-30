import Link from "next/link";

/**
 * The archive's index of sections.
 *
 * Replaces a grid of five identical cards — the shape the brief calls out as
 * the tell of a generated site, because it gives five destinations of very
 * different weight exactly the same visual weight. Here the index is numbered
 * and ruled like a table of contents, and the lead entry (the tournament
 * module, the largest part of the product) is set as a full entry with its
 * seals while the rest run as compact ruled lines.
 *
 * Content is the same five real routes as before; nothing is invented.
 */
const LEAD = {
  href: "/tournaments",
  index: "01",
  title: "Турниры",
  text: "Составы, жеребьёвка, сетки плей-офф, турнирные таблицы и результаты боёв — с полной историей изменений по каждому соступу.",
};

const ENTRIES = [
  {
    href: "/rules",
    index: "02",
    title: "Правила",
    text: "Версионированные регламенты и разделы правил с сохранением истории редакций.",
  },
  {
    href: "/education",
    index: "03",
    title: "Обучение",
    text: "Курсы, модули и уроки для спортсменов, инструкторов и судей.",
  },
  {
    href: "/athletes",
    index: "04",
    title: "Спортсмены",
    text: "Профили участников сообщества, уровень подготовки и опыт.",
  },
  {
    href: "/clubs",
    index: "05",
    title: "Клубы",
    text: "Клубы традиции, их география и состав участников.",
  },
];

export function DirectoryIndex() {
  return (
    <section aria-labelledby="directory-heading" className="space-y-6">
      <div className="flex items-center gap-4">
        <h2
          id="directory-heading"
          className="font-display shrink-0 text-2xl font-semibold tracking-tight"
        >
          Указатель разделов
        </h2>
        <span aria-hidden="true" className="h-px flex-1 bg-[var(--rule)] opacity-70" />
        <span className="record-label shrink-0 text-[var(--muted)]">05 записей</span>
      </div>

      {/* lead entry — full width, so the two-tier index sits on one baseline
          grid instead of leaving a ragged column of dead space */}
      <Link
        href={LEAD.href}
        className="group flex flex-col gap-6 border-t-2 border-[var(--rule)] py-7 transition-colors hover:border-[var(--accent)] md:flex-row md:items-end md:justify-between md:gap-12"
      >
        <div className="flex items-start gap-5 md:gap-7">
          <span className="font-record mt-2 text-sm text-[var(--accent)]">{LEAD.index}</span>
          <div className="min-w-0">
            <h3 className="font-display text-4xl font-semibold leading-[0.95] tracking-tight transition-colors group-hover:text-[var(--accent)] sm:text-[3.25rem]">
              {LEAD.title}
            </h3>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-[var(--muted)]">{LEAD.text}</p>
          </div>
        </div>
        <span className="record-label shrink-0 text-[var(--accent)] md:pb-1">
          Открыть{" "}
          <span
            aria-hidden="true"
            className="inline-block transition-transform group-hover:translate-x-1"
          >
            →
          </span>
        </span>
      </Link>

      {/* remaining entries — deliberately lighter: two ruled columns, no cards */}
      <ul className="grid border-t border-[var(--border-strong)] sm:grid-cols-2 sm:gap-x-14">
        {ENTRIES.map((entry) => (
          <li key={entry.href}>
            <Link
              href={entry.href}
              className="group flex h-full items-baseline gap-5 border-b border-[var(--border)] py-5 transition-colors hover:border-[var(--accent)]"
            >
              <span className="font-record text-xs text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]">
                {entry.index}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-display block text-lg font-semibold tracking-tight transition-colors group-hover:text-[var(--accent)]">
                  {entry.title}
                </span>
                <span className="mt-1.5 block text-sm leading-relaxed text-[var(--muted)]">
                  {entry.text}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--accent)]"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
