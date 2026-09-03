import { Container, TwoSided, cn } from "@/components/ui";
import { PhotoReveal } from "@/features/home/stenka-photo-reveal";

/**
 * СТЕНКА / КРУГ (README section 3) — two of the tradition's formats set as
 * opposing camps across a seam, using the shared `TwoSided` primitive: line
 * combat (стенка) on the left, single combat in a circle (круг) on the right.
 *
 * Town names below are the real geography of the Msta river valley (Tver/
 * Novgorod oblasts) standing in for illustrative rosters — not sourced from
 * any real athlete record, and not a rules claim (see CLAUDE.md's guardrail
 * against inventing tournament rules; this is scene-setting copy only).
 */
type Side = {
  label: string;
  title: string;
  text: string;
  participants: { name: string; city: string }[];
  image: { src: string; credit: string };
};

const STENKA_SIDE: Side = {
  label: "Стенка",
  title: "Стенка на стенку",
  text: "Два строя сходятся по прямой, плечом к плечу — линия против линии, до тех пор, пока один строй не подастся назад.",
  participants: [
    { name: "Соколов Андрей", city: "Боровичи" },
    { name: "Гришин Максим", city: "Валдай" },
    { name: "Фомичёв Илья", city: "Вышний Волочёк" },
  ],
  image: {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Lob_Stenka_na_stenku.jpg/1920px-Lob_Stenka_na_stenku.jpg",
    credit: "В. Лобачев · CC0",
  },
};

const KRUG_SIDE: Side = {
  label: "Круг",
  title: "Круговой бой",
  text: "Один на один в очерченном круге: соступ решает выпад, а не количество бойцов за спиной.",
  participants: [
    { name: "Морозов Кирилл", city: "Тверь" },
    { name: "Дмитриев Егор", city: "Удомля" },
    { name: "Клюев Артём", city: "Бологое" },
  ],
  image: {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Lob_Kulachni_boi.jpg/1920px-Lob_Kulachni_boi.jpg",
    credit: "В. Лобачев · CC0",
  },
};

function SidePanel({ side, mirror }: { side: Side; mirror: boolean }) {
  return (
    <div className="flex h-full flex-col gap-5">
      <div className={cn("space-y-3", mirror && "sm:text-right")}>
        <p className="record-label text-[var(--gold)]">{side.label}</p>
        <h2 className="font-display text-[2rem] font-semibold leading-[1.02] tracking-tight sm:text-[3.25rem]">
          {side.title}
        </h2>
        {/* min-h reserves 2 lines regardless of actual wrap — Стенка's text
            wraps to 2 lines here, Круг's to 1, and without this the shorter
            side's list/photo below climbed ~23px higher than the other's,
            visibly misaligning a layout that's otherwise identical on both
            sides. */}
        <p className="min-h-[46px] text-sm leading-relaxed text-[var(--muted)]">{side.text}</p>
      </div>

      <ul className="divide-y divide-[var(--border)] border border-[var(--border)] bg-[var(--surface-muted)]">
        {side.participants.map((participant) => (
          <li
            key={participant.name}
            className={cn(
              "flex items-baseline justify-between gap-3 px-4 py-2.5",
              mirror && "flex-row-reverse",
            )}
          >
            <span className="text-[0.9375rem] font-medium">{participant.name}</span>
            <span className="font-record text-[0.625rem] uppercase tracking-[0.1em] text-[var(--text-4)]">
              {participant.city}
            </span>
          </li>
        ))}
      </ul>

      <figure className="mt-1">
        <PhotoReveal className="block aspect-[3/2] w-full overflow-hidden border border-[var(--border-strong)]">
          <img
            src={side.image.src}
            alt={side.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </PhotoReveal>
        <figcaption className="record-label mt-2 text-[var(--text-4)]">{side.image.credit}</figcaption>
      </figure>
    </div>
  );
}

export function StenkaKrug() {
  return (
    <section id="stenka" className="wood-grain border-b-2 border-[var(--rule)] bg-[var(--surface)] py-16 sm:py-20">
      <Container wide>
        <div className="mb-10 flex items-center gap-4">
          <span className="record-label shrink-0 text-[var(--gold)]">Л. 03 · Стенка / круг</span>
          <span aria-hidden="true" className="h-px flex-1 bg-[var(--rule)] opacity-70" />
        </div>

        <TwoSided left={<SidePanel side={STENKA_SIDE} mirror />} right={<SidePanel side={KRUG_SIDE} mirror={false} />} mirror />
      </Container>
    </section>
  );
}
