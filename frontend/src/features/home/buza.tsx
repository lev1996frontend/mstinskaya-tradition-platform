"use client";

import { useEffect, useRef, useState } from "react";

import { Emblem } from "@/components/brand/emblem";
import { Container, cn } from "@/components/ui";
import { useBuza, type BuzaVersion } from "@/features/home/buza-context";

/**
 * "Буза" — the tradition's origin story (design_handoff_buza_river),
 * collapsed by default to a title + one-line hint and opened only by the
 * river-boat button in the header (`components/layout/river-strip.tsx`),
 * via the shared `useBuza`. Placed between the tournament bulletin and
 * "Стенка / круг" on the homepage, same slot as the design handoff.
 *
 * Unlike the tournament-rule sections elsewhere on this page, none of this
 * is a claim about the real Mstinskaya Tradition's confirmed rules (see
 * CLAUDE.md's guardrail on that) — it's the platform's own origin lore, in
 * the same documentary voice as `stenka-krug.tsx`'s illustrative rosters.
 */
const ETYMOLOGY_CHIPS: { key: BuzaVersion; label: string; text: string }[] = [
  {
    key: "drink",
    label: "Напиток",
    text: "«Буза» — старое название хмельного просяного напитка, которым артель отмечала конец сплава: не крепкий, но горячащий кровь — отсюда и переносное значение «раззадорить».",
  },
  {
    key: "buyat",
    label: "Буянить",
    text: "Глагол «бузить» — поднимать шум, спорить, задираться — в говорах верхневолжских артелей означал вызов на кулачный спор ещё до того, как «буза» стала именем самого состязания.",
  },
  {
    key: "korabl",
    label: "Корабль",
    text: "По третьей версии, слово идёт от самих судов: «бузник» — не только боец, но и гребец на груженной барке, и вызов «на бузу» звучал прямо с борта, пока лодки ждали очереди в затоне.",
  },
];

const ETYMOLOGY_DEFAULT =
  "У слова «буза» нет единого происхождения — ниже три версии, бытующие в среде клубов традиции.";

const RITUAL_STEPS: { label: string; text: string }[] = [
  {
    label: "Сбор",
    text: "Артель сходится на берегу или на льду реки — от разных барж и причалов, обычно ближе к вечеру, когда работа на сплаве встаёт.",
  },
  {
    label: "Круг",
    text: "Зрители смыкаются в живое кольцо, отмечая границу — выйти за неё значило выйти из спора, не дожидаясь исхода.",
  },
  {
    label: "Пляска",
    text: "Бойцы разогреваются пляской-разведкой — переступью, дробью, покачиванием — читая соперника прежде первого касания.",
  },
  {
    label: "Толчки",
    text: "Первые сближения идут через толчки в грудь и плечо — проверка стойки и духа соперника, ещё не самого удара.",
  },
  {
    label: "Уговор",
    text: "Круг решает миром: старший в артели или сами бойцы объявляют уговор — когда спор считается решённым и на чём сходятся стороны.",
  },
];

const LINEAGE: { year: string; text: string }[] = [
  {
    year: "1990",
    text: "В Вышнем Волочке открылся клуб «Белый волк» — первым записал обряд бузы как правила спортивной дисциплины.",
  },
  {
    year: "2011",
    text: "Клубы традиции вступили в WoMAU, обозначив бузу на карте современных боевых искусств за пределами верхневолжских артелей.",
  },
  {
    year: "16 лет",
    text: "Турниры «Мстинская традиция» проводятся ежегодно, продолжая обряд уже в форме официальных состязаний с судьями и разрядами.",
  },
];

export function Buza() {
  /* The selected reading lives in the shared context, not in local state: the
     river's bays (`river-spine.tsx`) open this section *on* a reading, and the
     chips below have to show that choice rather than contradict it. */
  const { open, toggle, version: etymologySelected, setVersion: setEtymologySelected } = useBuza();
  const [ritualStepActive, setRitualStepActive] = useState(0);
  const [struck, setStruck] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll the section into view when something opens it — only fires on the
  // false→true transition (the effect's dependency), never on mount (which
  // always starts `open` false), and never on close. It matters for the margin
  // river's bays, which can open the section from anywhere on the page; the
  // section's own emblem is already on screen when it is pressed, and this
  // simply settles the heading to the top under it.
  useEffect(() => {
    if (open) sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open]);

  const etymologyText = ETYMOLOGY_CHIPS.find((chip) => chip.key === etymologySelected)?.text ?? ETYMOLOGY_DEFAULT;

  return (
    <section
      ref={sectionRef}
      id="buza"
      className="weave-deep border-b-2 border-[var(--rule)] bg-[var(--background-deep)] py-16 sm:py-20"
    >
      <Container wide>
        <div className="mb-10 flex items-center gap-4">
          <span className="record-label text-[var(--gold)]">Исток традиции</span>
          <span aria-hidden="true" className="h-px flex-1 bg-[var(--rule)] opacity-70" />
        </div>

        <h2 className="font-display text-[2.25rem] font-bold tracking-tight sm:text-[3rem]">Буза</h2>

        {/* The way in, standing in the block it opens.

            It used to be three symbols on a strip in the header, which meant
            the section had to carry a line of instructions naming the control
            and pointing up the page at it. A mark you can see next to the
            heading needs no such sentence — so the sentence is gone, and the
            emblem answers for itself.

            It keeps the shield's own vocabulary rather than becoming a plain
            button: the blow lands and it gives ground (`.shield-brace`), a ring
            of impact crosses its face (`.strike-ring`), and while the section is
            open it holds the guard (`.shield-guard-raised`) — an open section
            gets a visible posture instead of a visible wound. The margin
            river's застава strikes the identical pose, so the gesture reads as
            one thing in two places. */}
        <div className="mt-6 flex items-center gap-4 sm:gap-5">
          <button
            type="button"
            onClick={() => {
              toggle();
              setStruck(true);
            }}
            onAnimationEnd={(event) => {
              // `.strike-ring` (650ms) outlasts `.shield-brace` (420ms), so
              // clearing on the ring clears both. Bound on the button because
              // the two animations run on separate elements and `animationend`
              // only bubbles up, never sideways.
              if (event.animationName !== "strike-ring") return;
              setStruck(false);
            }}
            aria-expanded={open}
            aria-controls="buza-story"
            /* Full strength at rest. The three symbols this replaced sat at 45%
               until hovered, which suited decoration riding a strip and would be
               wrong for the one control this block has. It warms to the
               section's own gold on hover or focus — gold rather than the
               oxblood, which is spent on actions elsewhere, and the mark itself
               stays monochrome either way. */
            className={cn(
              "grid shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0",
              "text-[var(--foreground)] transition-colors hover:text-[var(--gold)]",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)] focus-visible:text-[var(--gold)]",
              open ? "shield-on-guard" : "",
            )}
          >
            <span className="relative grid size-20 place-items-center">
              <span
                className={cn("shield-guard grid place-items-center", open ? "shield-guard-raised" : "")}
              >
                {/* One mark at one size, not a `sm:hidden` pair: `Emblem` sets
                    its box as an inline style, and an inline style beats a
                    `hidden` class — rendering two would show both, stacked. */}
                <span className={cn("grid place-items-center", struck ? "shield-brace" : "")}>
                  <Emblem size={80} />
                </span>
              </span>
              {struck ? (
                <span
                  aria-hidden="true"
                  className="strike-ring pointer-events-none absolute inset-0 m-auto size-12"
                />
              ) : null}
            </span>
            {/* The label is the accessible name and the visible one at once —
                an emblem on its own tells nobody what pressing it does. */}
            <span className="sr-only">
              {open ? "Свернуть рассказ о бузе" : "Раскрыть рассказ о бузе"}
            </span>
          </button>

          <p className="text-[0.9375rem] leading-relaxed text-[var(--text-4)]">
            {open ? "Знак свёрнет рассказ." : "Три версии одного слова — нажмите на знак."}
          </p>
        </div>

        {/* The region the emblem's `aria-controls` names. Unmounted rather than
            hidden while closed, as it always was — the id travels with it, and
            `aria-expanded` on the button is what a screen reader reads either
            way. */}
        {open ? (
          <div id="buza-story">
            <p className="pop-in mt-4 max-w-2xl text-[0.9375rem] leading-[1.75] text-[var(--muted)]">
              Буза — обрядовое рукопашное состязание Тверской земли, выросшее из уклада артелей на
              Вышневолоцкой водной системе. Бурлаки, портовые грузчики и судовые экипажи, нанимавшиеся артелями,
              называли себя «бузниками» — в этом слове сходились сразу три занятия: гребец, охранник и
              кулачный боец.
            </p>

            <div className="pop-in mt-8 grid gap-10 sm:grid-cols-2 sm:gap-14">
              <div>
                <div className="border-t border-[var(--border)] pt-5">
                  <p className="record-label mb-3 text-[var(--text-4)]">Слово с тремя историями</p>
                  <div className="flex flex-wrap gap-2">
                    {ETYMOLOGY_CHIPS.map((chip) => {
                      const selected = etymologySelected === chip.key;
                      return (
                        <button
                          key={chip.key}
                          type="button"
                          onClick={() => setEtymologySelected(selected ? null : chip.key)}
                          aria-pressed={selected}
                          className={cn(
                            "record-label cursor-pointer border px-4 py-2 transition-colors",
                            selected
                              ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold-strong)]"
                              : "border-[var(--border-strong)] bg-transparent text-[var(--muted)] hover:border-[var(--gold)] hover:text-[var(--foreground)]",
                          )}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3.5 min-h-[3.2rem] text-sm leading-relaxed text-[var(--text-3)]">
                    {etymologyText}
                  </p>
                </div>

                <figure className="mt-7 border-l-2 border-[var(--gold)] pl-5">
                  <p className="font-display text-lg italic leading-snug text-[var(--muted)]">
                    «Побузиться, побузиться,
                    <br />
                    Побузиться хочется.
                    <br />
                    Молодая кровь горячая,
                    <br />
                    На волю просится!»
                  </p>
                  <figcaption className="record-label mt-2 text-[var(--text-4)]">Частушка «под Бузу»</figcaption>
                </figure>
              </div>

              <div>
                <p className="record-label mb-4 text-[var(--text-4)]">Как это было устроено</p>
                <div className="flex flex-col gap-px border border-[var(--border)] bg-[var(--border)]">
                  {RITUAL_STEPS.map((step, index) => {
                    const active = ritualStepActive === index;
                    return (
                      <button
                        key={step.label}
                        type="button"
                        onClick={() => setRitualStepActive(index)}
                        className={cn(
                          "flex w-full cursor-pointer items-baseline gap-3.5 px-[18px] py-4 text-left transition-colors",
                          active ? "bg-[var(--surface-muted)]" : "bg-[var(--background-deep)]",
                        )}
                      >
                        <span
                          className={cn(
                            "font-record shrink-0 text-xs",
                            active ? "text-[var(--gold)]" : "text-[var(--text-4)]",
                          )}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>
                          <span
                            className={cn(
                              "font-display block text-xl font-semibold",
                              active ? "text-[var(--gold)]" : "text-[var(--foreground)]",
                            )}
                          >
                            {step.label}
                          </span>
                          {active ? (
                            <span className="pop-in mt-1.5 block text-sm leading-relaxed text-[var(--muted)]">
                              {step.text}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pop-in mt-14 grid gap-px border-y border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
              {LINEAGE.map((entry) => (
                <div key={entry.year} className="bg-[var(--surface-muted)] p-5 sm:p-[22px]">
                  <span className="font-display text-2xl font-bold text-[var(--gold)]">{entry.year}</span>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{entry.text}</p>
                </div>
              ))}
            </div>

            <p className="pop-in mt-6 text-[0.9375rem] leading-relaxed text-[var(--foreground)]">
              Турниры этого сайта носят то же имя — <strong className="text-[var(--accent)]">«Мстинская традиция»</strong> —
              потому что продолжают ту самую линию: обряд, перенесённый в зал, с судьями, разрядами и жребием.
            </p>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
