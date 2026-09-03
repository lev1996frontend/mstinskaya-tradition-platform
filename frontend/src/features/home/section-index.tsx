import Link from "next/link";

/**
 * Homepage anchor index (README section 11) — a sibling to
 * `directory-index.tsx`, not a replacement: that one links to real routes
 * (/tournaments, /rules, …), this one links to in-page anchors built across
 * this section and one other (СНАРЯЖЕНИЕ in `equipment.tsx`, АРХИВ in
 * `gear-archive.tsx`) landing on this same page. Deliberately a different
 * shape: numbered ruled rows that step via `padding-left` on hover, not
 * `directory-index.tsx`'s arrow-translate — two indexes that read as two
 * different documents, not one component reused with new copy.
 *
 * Поединок/Сетка/Правила/Бойцы used to anchor here too — they moved to
 * `/tournaments` (see `app/tournaments/page.tsx`) and are no longer listed.
 */
const SECTIONS: { href: string; index: string; title: string; text: string }[] = [
  {
    href: "#snaryazhenie",
    index: "01",
    title: "Снаряжение",
    text: "Опись четырёх разрядов лота традиции — от безоружного боя до кистеня.",
  },
  {
    href: "#arhiv-ekipirovki",
    index: "02",
    title: "Архив",
    text: "Девять предметов обязательного комплекта, один за другим — от маски до шароваров.",
  },
  {
    href: "#hronika",
    index: "03",
    title: "Хроника",
    text: "Документальные снимки состязаний прошлых лет.",
  },
  {
    href: "#zhivopis",
    index: "04",
    title: "Живопись",
    text: "Кулачный бой в живописи и архивной графике — от начала XIX века до наших дней.",
  },
];

export function SectionIndex() {
  return (
    <nav aria-label="Разделы страницы" className="border-t border-[var(--border-strong)]">
      {SECTIONS.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          className="group grid grid-cols-[2.5rem_1fr] items-baseline gap-x-5 gap-y-1.5 border-b border-[var(--border)] py-7 pr-2 pl-2 transition-all duration-[400ms] ease-[cubic-bezier(0.2,0.9,0.2,1)] hover:bg-[var(--surface-muted)] hover:pl-[26px] sm:grid-cols-[70px_minmax(12rem,1fr)_minmax(0,26rem)_40px] sm:items-center sm:gap-x-8"
        >
          <span className="font-record text-sm text-[var(--muted)]">{section.index}</span>
          <span className="font-display text-xl font-semibold tracking-tight sm:text-[2.125rem]">
            {section.title}
          </span>
          <span className="col-span-2 text-sm leading-relaxed text-[var(--muted)] sm:col-span-1">
            {section.text}
          </span>
          <span
            aria-hidden="true"
            className="hidden text-[var(--accent)] transition-transform group-hover:translate-x-1 sm:block"
          >
            →
          </span>
        </Link>
      ))}
    </nav>
  );
}
