import type { ReactNode } from "react";

import { Container } from "@/components/ui";
import { PhotoReveal } from "@/features/home/stenka-photo-reveal";

/**
 * ЖИВОПИСНЫЙ РЯД (README section 10). Four blocks: a wide lead sheet (the
 * client's own 1845 drawing — rights unverified, see the provenance note
 * below), one larger painting with text beside it, a row of three smaller
 * paintings, and a closing documentary photograph.
 *
 * The `sepia/contrast/brightness` filter is applied only to the five PD
 * paintings, unifying tone across sources of very different age and scan
 * quality — never to the lead sheet (a drawing, not a painting, and already
 * a single source) or the closing photograph (documentary, meant to read as
 * a photograph, not tinted to match the canvases).
 */
const PAINTING_FILTER = "sepia(0.18) contrast(1.05) brightness(0.93)";

const LEAD_SHEET = {
  src: "/archive/toropetsky-kulachny-boy-1845.jpg",
  title: "Торопецкий кулачный бой и гулянье",
  year: "1845",
  note: "Рисунок с натуры",
};

const FEATURED_PAINTING = {
  author: "М. И. Песков",
  title: "Кулачный бой при Иване IV",
  year: "1862",
  src: "https://upload.wikimedia.org/wikipedia/commons/4/46/%D0%9F%D0%B5%D1%81%D0%BA%D0%BE%D0%B2_%D0%9C%D0%B8%D1%85%D0%B0%D0%B8%D0%BB_%D0%98%D0%B2%D0%B0%D0%BD%D0%BE%D0%B2%D0%B8%D1%87_-_%D0%9A%D1%83%D0%BB%D0%B0%D1%87%D0%BD%D1%8B%D0%B9_%D0%B1%D0%BE%D0%B9_%D0%BF%D1%80%D0%B8_%D0%98%D0%B2%D0%B0%D0%BD%D0%B5_IV_%281862%29.jpg",
  text: "Академическое полотно XIX века воспроизводит летописный сюжет: кулачный бой как публичное состязание, а не стихийная драка — с судьями и правилами, признанными обеими сторонами.",
};

const ROW_PAINTINGS = [
  {
    author: "Ф. Г. Солнцев",
    title: "Кулачный бой",
    year: "1836",
    src: "https://upload.wikimedia.org/wikipedia/commons/f/f7/%D0%A1%D0%BE%D0%BB%D0%BD%D1%86%D0%B5%D0%B2_%D0%9A%D1%83%D0%BB%D0%B0%D1%87%D0%BD%D1%8B%D0%B9_%D0%B1%D0%BE%D0%B9_1836.jpg",
  },
  {
    author: "В. М. Васнецов",
    title: "«Кулачный бой» (илл. к «Песне о купце Калашникове»)",
    year: "1891",
    src: "https://upload.wikimedia.org/wikipedia/commons/5/5f/%D0%9A%D1%83%D0%BB%D0%B0%D1%87%D0%BD%D1%8B%D0%B9_%D0%B1%D0%BE%D0%B9._%D0%98%D0%BB%D0%BB%D1%8E%D1%81%D1%82%D1%80%D0%B0%D1%86%D0%B8%D1%8F_%D0%BA_%D0%BF%D0%BE%D1%8D%D0%BC%D0%B5_%C2%AB%D0%9F%D0%B5%D1%81%D0%BD%D1%8F_%D0%BE_%D0%BA%D1%83%D0%BF%D1%86%D0%B5_%D0%9A%D0%B0%D0%BB%D0%B0%D1%88%D0%BD%D0%B8%D0%BA%D0%BE%D0%B2%D0%B5%C2%BB.jpg",
  },
  {
    author: "Г. Г. Гейслер",
    title: "Лист из «Забав русского народа»",
    year: "1805",
    src: "https://upload.wikimedia.org/wikipedia/commons/5/5e/03_Spiele_und_Blustigungen_der_Russen_aus_den_niederen_Volksschichten.jpg",
  },
];

const DOCUMENTARY_PHOTO = {
  author: "М. П. Дмитриев",
  title: "Кулачный бой перед ночлежным домом",
  year: "до 1917",
  src: "https://upload.wikimedia.org/wikipedia/commons/9/99/%D0%9A%D1%83%D0%BB%D0%B0%D1%87%D0%BD%D1%8B%D0%B9_%D0%B1%D0%BE%D0%B9_%D0%BF%D0%B5%D1%80%D0%B5%D0%B4_%D0%BD%D0%BE%D1%87%D0%BB%D0%B5%D0%B6%D0%BD%D1%8B%D0%BC_%D0%B4%D0%BE%D0%BC%D0%BE%D0%BC.jpg",
  text: "Нижегородский фотограф М. П. Дмитриев снимал уличную жизнь без постановки — здесь кулачный бой попал в кадр как часть будничной сцены, а не как постановочный сюжет.",
};

function CreditPlaque({ children }: { children: ReactNode }) {
  return (
    <span className="font-record absolute bottom-2 left-2 rounded-[var(--radius-sm)] bg-[rgba(16,14,12,0.72)] px-2 py-1 text-[0.5rem] uppercase tracking-[0.16em] text-[var(--text-4)]">
      {children}
    </span>
  );
}

export function Paintings() {
  return (
    <section id="zhivopis" className="border-b-2 border-[var(--rule)] bg-[var(--background-deep)] py-16 sm:py-20">
      <Container wide className="space-y-14">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <p className="record-label text-[var(--gold)]">Л. 11 · Живописный ряд</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-[3rem]">Как это писали</h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-[var(--muted)] sm:text-right">
            Разные руки и разный век — от рисунка с натуры до академического холста и уличного снимка.
            Ряд собран как то, что дошло до архива, а не как единая постановка.
          </p>
        </div>

        {/* lead sheet — client asset, rights unverified */}
        <figure className="relative">
          <PhotoReveal
            className="relative block aspect-[1280/868] w-full overflow-hidden border border-[var(--border-strong)]"
            style={{ animationDuration: "1.2s" }}
          >
            <img
              src={LEAD_SHEET.src}
              alt={`${LEAD_SHEET.title}, ${LEAD_SHEET.year}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[rgba(16,14,12,0.88)] to-transparent"
            />
          </PhotoReveal>
          <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5 sm:p-8">
            <span className="font-display text-2xl font-semibold text-[var(--foreground)] sm:text-[2.5rem]">
              {LEAD_SHEET.title}, {LEAD_SHEET.year}
            </span>
            <span className="record-label text-[var(--text-4)]">{LEAD_SHEET.note}</span>
            {/* deliberately distinct from the PD credit plaques below: dashed
                warning-toned tag, not a quiet dark plaque, so an unverified
                asset never reads as equally cleared */}
            <span className="record-label pointer-events-auto inline-flex w-fit items-center gap-1.5 border border-dashed border-[var(--warning)]/50 bg-[var(--warning-soft)] px-2 py-1 text-[var(--warning)]">
              Архив сообщества · происхождение уточняется
            </span>
          </figcaption>
        </figure>

        {/* featured painting + text */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)]">
          <figure className="relative">
            <PhotoReveal
              className="block aspect-[4/3] w-full overflow-hidden border border-[var(--border-strong)]"
              style={{ animationDuration: "1.1s" }}
            >
              <img
                src={FEATURED_PAINTING.src}
                alt={`${FEATURED_PAINTING.author} · «${FEATURED_PAINTING.title}»`}
                loading="lazy"
                className="h-full w-full object-cover"
                style={{ filter: PAINTING_FILTER }}
              />
            </PhotoReveal>
            <CreditPlaque>
              {FEATURED_PAINTING.author} · {FEATURED_PAINTING.year} · PD
            </CreditPlaque>
          </figure>
          <div className="flex flex-col justify-center gap-3">
            <p className="record-label text-[var(--gold)]">Живопись · Public domain</p>
            <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-[2.75rem]">
              {FEATURED_PAINTING.title}
            </h3>
            <p className="text-sm leading-relaxed text-[var(--muted)]">{FEATURED_PAINTING.text}</p>
          </div>
        </div>

        {/* row of three */}
        <div className="grid gap-7 sm:grid-cols-3">
          {ROW_PAINTINGS.map((painting, index) => (
            <figure key={painting.title} className="relative">
              <PhotoReveal
                className="block aspect-[4/3] w-full overflow-hidden border border-[var(--border-strong)]"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <img
                  src={painting.src}
                  alt={`${painting.author} · «${painting.title}»`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                  style={{ filter: PAINTING_FILTER }}
                />
              </PhotoReveal>
              <CreditPlaque>
                {painting.author} · {painting.year} · PD
              </CreditPlaque>
              <figcaption className="mt-2.5 text-sm leading-relaxed text-[var(--muted)]">
                <span className="font-semibold text-[var(--foreground)]">{painting.title}.</span> {painting.author},{" "}
                {painting.year}.
              </figcaption>
            </figure>
          ))}
        </div>

        {/* closing documentary photo — no sepia filter, reads as a photograph */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <figure className="relative">
            <PhotoReveal className="block aspect-video w-full overflow-hidden border border-[var(--border-strong)]">
              <img
                src={DOCUMENTARY_PHOTO.src}
                alt={`${DOCUMENTARY_PHOTO.author} · «${DOCUMENTARY_PHOTO.title}»`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </PhotoReveal>
            <CreditPlaque>
              {DOCUMENTARY_PHOTO.author} · {DOCUMENTARY_PHOTO.year} · PD
            </CreditPlaque>
          </figure>
          <div className="flex flex-col justify-center gap-3">
            <p className="record-label text-[var(--gold)]">Фотография · Public domain</p>
            <h3 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{DOCUMENTARY_PHOTO.title}</h3>
            <p className="text-sm leading-relaxed text-[var(--muted)]">{DOCUMENTARY_PHOTO.text}</p>
          </div>
        </div>
      </Container>
    </section>
  );
}
