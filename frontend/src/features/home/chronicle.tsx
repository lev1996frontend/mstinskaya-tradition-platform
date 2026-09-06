import Image from "next/image";

import { Container, cn } from "@/components/ui";
import { PhotoReveal } from "@/features/home/stenka-photo-reveal";

/**
 * ХРОНИКА (README section 9) — three documentary photographs. Each frame
 * combines the shared scroll-triggered `.unmask` (via `PhotoReveal`, see that
 * file) with the continuous `.ken` drift once revealed, so the photo settles
 * into view and then keeps a slow, quiet motion rather than sitting static.
 */
type ChroniclePhoto = {
  n: string;
  src: string;
  credit: string;
  caption: string;
  aspect: string;
};

const CHRONICLE_PHOTOS: ChroniclePhoto[] = [
  {
    n: "01",
    src: "/archive/lob-kulachny-boy.jpg",
    credit: "В. Лобачев · CC0",
    caption: "Круговой бой: один на один в очерченном круге, зрители — по кромке.",
    aspect: "aspect-[4/3]",
  },
  {
    n: "02",
    src: "/archive/lob-stenka-na-stenku.jpg",
    credit: "В. Лобачев · CC0",
    caption: "Стенка на стенку: строй на строй, до того, как один подастся назад.",
    aspect: "aspect-[3/4]",
  },
  {
    n: "03",
    src: "/archive/maslenichny-boy-malye-korely-2019.jpg",
    credit: "FrolovaAlex · CC BY-SA 4.0",
    caption: "Масленичный бой в деревне Малые Корелы, Русский Север. 2019 год.",
    aspect: "aspect-[3/4]",
  },
];

function ChroniclePhotoFrame({ photo }: { photo: ChroniclePhoto }) {
  return (
    <figure className="flex flex-col gap-3">
      <div className={cn("relative overflow-hidden border border-[var(--border-strong)]", photo.aspect)}>
        {/* `fill` rather than intrinsic width/height: the frame's aspect ratio
            is set by `photo.aspect` above and the scan is cropped into it, so
            the picture's own dimensions never reach the layout. `PhotoReveal`
            renders a `relative` box, which is what `fill` anchors to.

            `sizes` matters here — without it the browser assumes 100vw and
            fetches a full-width source for what is at most a third of the row
            on a wide screen. */}
        <PhotoReveal className="block h-full w-full">
          <Image
            src={photo.src}
            alt={photo.caption}
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            className="ken object-cover"
          />
        </PhotoReveal>
        <span className="font-record absolute bottom-2 left-2 rounded-[var(--radius-sm)] bg-[rgba(16,14,12,0.72)] px-2 py-1 text-[0.5rem] uppercase tracking-[0.16em] text-[var(--text-4)]">
          {photo.credit}
        </span>
      </div>
      <figcaption className="text-sm leading-relaxed text-[var(--muted)]">
        <span className="record-label mr-2 text-[var(--gold)]">{photo.n}</span>
        {photo.caption}
      </figcaption>
    </figure>
  );
}

export function Chronicle() {
  return (
    <section id="hronika" className="wood-grain border-b-2 border-[var(--rule)] bg-[var(--surface-muted)] py-16 sm:py-20">
      <Container wide>
        <div className="mb-10 flex items-center gap-4">
          <span className="record-label shrink-0 text-[var(--gold)]">Л. 10 · Хроника</span>
          <span aria-hidden="true" className="h-px flex-1 bg-[var(--rule)] opacity-70" />
        </div>

        <div className="grid gap-7 lg:grid-cols-[1.7fr_1fr_1fr]">
          {CHRONICLE_PHOTOS.map((photo) => (
            <ChroniclePhotoFrame key={photo.n} photo={photo} />
          ))}
        </div>
      </Container>
    </section>
  );
}
