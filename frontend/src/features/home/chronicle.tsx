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
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Lob_Kulachni_boi.jpg/1920px-Lob_Kulachni_boi.jpg",
    credit: "В. Лобачев · CC0",
    caption: "Круговой бой: один на один в очерченном круге, зрители — по кромке.",
    aspect: "aspect-[4/3]",
  },
  {
    n: "02",
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Lob_Stenka_na_stenku.jpg/1920px-Lob_Stenka_na_stenku.jpg",
    credit: "В. Лобачев · CC0",
    caption: "Стенка на стенку: строй на строй, до того, как один подастся назад.",
    aspect: "aspect-[3/4]",
  },
  {
    n: "03",
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/%D0%9C%D0%B0%D1%81%D0%BB%D0%B5%D0%BD%D0%B8%D1%87%D0%BD%D1%8B%D0%B9_%D0%BA%D1%83%D0%BB%D0%B0%D1%87%D0%BD%D1%8B%D0%B9_%D0%B1%D0%BE%D0%B9._%D0%9C%D0%B0%D0%BB%D1%8B%D0%B5_%D0%9A%D0%BE%D1%80%D0%B5%D0%BB%D1%8B%2C_%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9_%D0%A1%D0%B5%D0%B2%D0%B5%D1%80%2C_2019.jpg/1920px-%D0%9C%D0%B0%D1%81%D0%BB%D0%B5%D0%BD%D0%B8%D1%87%D0%BD%D1%8B%D0%B9_%D0%BA%D1%83%D0%BB%D0%B0%D1%87%D0%BD%D1%8B%D0%B9_%D0%B1%D0%BE%D0%B9._%D0%9C%D0%B0%D0%BB%D1%8B%D0%B5_%D0%9A%D0%BE%D1%80%D0%B5%D0%BB%D1%8B%2C_%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9_%D0%A1%D0%B5%D0%B2%D0%B5%D1%80%2C_2019.jpg",
    credit: "FrolovaAlex · CC BY-SA 4.0",
    caption: "Масленичный бой в деревне Малые Корелы, Русский Север. 2019 год.",
    aspect: "aspect-[3/4]",
  },
];

function ChroniclePhotoFrame({ photo }: { photo: ChroniclePhoto }) {
  return (
    <figure className="flex flex-col gap-3">
      <div className={cn("relative overflow-hidden border border-[var(--border-strong)]", photo.aspect)}>
        <PhotoReveal className="block h-full w-full">
          <img src={photo.src} alt={photo.caption} loading="lazy" className="ken h-full w-full object-cover" />
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
    <section id="hronika" className="border-b-2 border-[var(--rule)] bg-[var(--surface-muted)] py-16 sm:py-20">
      <Container wide>
        <div className="mb-10 flex items-center gap-4">
          <span className="record-label shrink-0 text-[var(--gold)]">Л. 09 · Хроника</span>
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
