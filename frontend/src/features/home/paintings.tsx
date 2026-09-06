import Image from "next/image";
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
  src: "/archive/peskov-kulachny-boy-1862.jpg",
  text: "Академическое полотно XIX века воспроизводит летописный сюжет: кулачный бой как публичное состязание, а не стихийная драка — с судьями и правилами, признанными обеими сторонами.",
};

const ROW_PAINTINGS = [
  {
    author: "Ф. Г. Солнцев",
    title: "Кулачный бой",
    year: "1836",
    src: "/archive/solntsev-kulachny-boy-1836.jpg",
  },
  {
    author: "В. М. Васнецов",
    title: "«Кулачный бой» (илл. к «Песне о купце Калашникове»)",
    year: "1891",
    src: "/archive/vasnetsov-kulachny-boy-1891.jpg",
  },
  {
    author: "Г. Г. Гейслер",
    title: "Лист из «Забав русского народа»",
    year: "1805",
    src: "/archive/geissler-zabavy-russkogo-naroda-1805.jpg",
  },
];

const DOCUMENTARY_PHOTO = {
  author: "М. П. Дмитриев",
  title: "Кулачный бой перед ночлежным домом",
  year: "до 1917",
  src: "/archive/dmitriev-kulachny-boy-nochlezhny-dom.jpg",
  text: "Нижегородский фотограф М. П. Дмитриев снимал уличную жизнь без постановки — здесь кулачный бой попал в кадр как часть будничной сцены, а не как постановочный сюжет.",
};

/**
 * Mount for the plates that are shown *contained* on a board rather than
 * cropped to the frame (the featured canvas and the row of three).
 *
 * Those frames carry their own padding — the board the plate is mounted on.
 * A `fill` image cannot simply be dropped into them: an absolutely positioned
 * box resolves `inset: 0` against its ancestor's *padding* box, so it would
 * paint straight over the mount and the picture would sit flush to the
 * border. This wrapper re-establishes a containing block inside the padding,
 * which is where the plate actually belongs.
 */
function MountedPlate({ children }: { children: ReactNode }) {
  return <div className="relative h-full w-full">{children}</div>;
}

function CreditPlaque({ children }: { children: ReactNode }) {
  return (
    <span className="font-record absolute bottom-2 left-2 rounded-[var(--radius-sm)] bg-[rgba(16,14,12,0.72)] px-2 py-1 text-[0.5rem] uppercase tracking-[0.16em] text-[var(--text-4)]">
      {children}
    </span>
  );
}

export function Paintings() {
  return (
    <section
      id="zhivopis"
      className="weave-deep border-b-2 border-[var(--rule)] bg-[var(--background-deep)] py-16 sm:py-20"
    >
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
            <Image
              src={LEAD_SHEET.src}
              alt={`${LEAD_SHEET.title}, ${LEAD_SHEET.year}`}
              fill
              sizes="100vw"
              className="object-cover"
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

        {/* featured painting + text.

            A `<section id>` and not a plain `div`: this section is by some way
            the longest thing on the homepage — it alone spans about half the
            page's whole scroll — so the margin river had one mark at its head
            and then nothing for the rest of the way down. The canvases are the
            honest second place in it: above this line the section shows a
            drawing made from life in 1845, below it the painted record. The
            river charts off `main section[id]`, so an id here is all the rail
            needs.

            Deliberately *not* on the closing documentary photograph, which
            would be the better split of the three media on show: that block
            begins past the page's own maximum scroll, its charted position
            clamps to 1, and a stop at 1 leaves the boat unable to sail past it
            — the братина below would never be reachable. */}
        <section id="holsty" className="grid gap-10 lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)]">
          <figure className="relative">
            {/* Mounted like the three below it. The canvas is 620×420, so a
                4:3 frame was cropping its sides *and* stretching what was left
                past its own resolution; contained, it is shown at the size it
                actually is. */}
            <PhotoReveal
              className="block aspect-[4/3] w-full overflow-hidden border border-[var(--border-strong)] bg-[var(--surface-muted)] p-2.5"
              style={{ animationDuration: "1.1s" }}
            >
              <MountedPlate>
                <Image
                  src={FEATURED_PAINTING.src}
                  alt={`${FEATURED_PAINTING.author} · «${FEATURED_PAINTING.title}»`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 620px"
                  className="object-contain"
                  style={{ filter: PAINTING_FILTER }}
                />
              </MountedPlate>
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
        </section>

        {/* row of three */}
        <div className="grid gap-7 sm:grid-cols-3">
          {ROW_PAINTINGS.map((painting, index) => (
            <figure key={painting.title}>
              {/* The plaque is `absolute bottom-2`, so it anchors to the nearest
                  positioned ancestor. With `relative` on the whole `figure` —
                  which here also holds the caption — that ancestor was the
                  figure, and the plaque sat under the picture instead of on it:
                  fine while a caption ran to one line, and straight through the
                  words as soon as one wrapped to two (Васнецов's, the longest
                  of the three). This wrapper is the picture and nothing else,
                  which is what the plaque was always meant to be pinned to. */}
              <div className="relative">
              {/* Mounted, not cropped. `object-cover` in a 4:3 frame was
                  cutting these three to pieces — two of them are portraits
                  (Солнцев 636×794, Васнецов 772×1113) and the frame was
                  landscape, so it took roughly half the height off the
                  Васнецов and stood the fighters off the bottom edge.

                  4:5 because it is Солнцев's own ratio and the closest single
                  frame to a set that runs 0.69 / 0.80 / 1.27: every plate is
                  whole, and what is left over reads as the board it is mounted
                  on rather than as a gap. Equal frames are also what keeps the
                  row aligned — the captions sit on one line across all three
                  however tall the picture inside is. */}
              <PhotoReveal
                className="block aspect-[4/5] w-full overflow-hidden border border-[var(--border-strong)] bg-[var(--surface-muted)] p-2"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <MountedPlate>
                  <Image
                    src={painting.src}
                    alt={`${painting.author} · «${painting.title}»`}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-contain"
                    style={{ filter: PAINTING_FILTER }}
                  />
                </MountedPlate>
              </PhotoReveal>
              <CreditPlaque>
                {painting.author} · {painting.year} · PD
              </CreditPlaque>
              </div>
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
              <Image
                src={DOCUMENTARY_PHOTO.src}
                alt={`${DOCUMENTARY_PHOTO.author} · «${DOCUMENTARY_PHOTO.title}»`}
                fill
                sizes="(max-width: 1024px) 100vw, 66vw"
                className="object-cover"
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
