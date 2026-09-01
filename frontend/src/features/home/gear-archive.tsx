"use client";

import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo, type Variants } from "framer-motion";

import { Container, cn } from "@/components/ui";
import { EQUIPMENT_ITEMS } from "@/features/home/equipment-items";
import { GEAR_ARCHIVE_SELECT_EVENT } from "@/lib/gear-archive-link";
import { TURN_EASE } from "@/lib/motion";

const TOTAL = EQUIPMENT_ITEMS.length;
const SWIPE_OFFSET_THRESHOLD = 60;
const SWIPE_VELOCITY_THRESHOLD = 400;

function pad(index: number) {
  return String(index + 1).padStart(2, "0");
}

const slideVariants: Variants = {
  enter: (direction: 1 | -1) => ({ opacity: 0, x: direction * 20, scale: 0.98 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (direction: 1 | -1) => ({ opacity: 0, x: direction * -20, scale: 0.98 }),
};

/**
 * "Архив экипировки" — a single-exhibit museum slider: ONE опись item on
 * screen at a time (image, title, subtitle, description), never a grid or a
 * ledger of all nine. An earlier version showed a numbered list of all 9
 * items beside the active one — replaced outright per explicit direction
 * ("НЕ показывать остальные 8 карточками рядом. Они находятся только в
 * данных слайдера"), not refined.
 *
 * Data-driven: every slide renders from `EQUIPMENT_ITEMS[index]` through the
 * one `Exhibit` render below — there is no per-item JSX. `EQUIPMENT_ITEMS`
 * (`equipment-items.ts`) stays the single source of truth shared with
 * `hero-clash.tsx`'s `EquipmentPlate` and `helmet-reveal.tsx`'s callouts;
 * this file just also reads its `subtitle`/`image` fields.
 *
 * No real photos exist yet for any of the 9 items (`image` is `undefined`
 * on every entry) — `ExhibitSwatch` (an honest "specimen not yet
 * illustrated" placeholder, not a guess at the object's actual shape) covers
 * every slide for now. Filling in an item's `image` path once a real file
 * lands at `public/references/exhibits/` is the only change needed to swap
 * that one slide over to the real photo — nothing else in this file changes.
 */
export function GearArchive() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const reduceMotion = useReducedMotion();
  const item = EQUIPMENT_ITEMS[index];

  const step = (delta: 1 | -1) => {
    setDirection(delta);
    setIndex((current) => (current + delta + TOTAL) % TOTAL);
  };

  // Keyboard: ← / → step through exhibits. Window-level, mirroring the only
  // existing keydown precedent in the codebase (`site-header.tsx`'s Escape
  // listener for the mobile menu) rather than inventing a new pattern.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Deep-link target: the hero's опись grid (`EquipmentPlate`) dispatches
  // this to jump straight to a specific exhibit — see `@/lib/gear-archive-
  // link`. `direction` picked from the jump distance so the slide still
  // animates toward where the target actually is, not always forward.
  useEffect(() => {
    function onSelect(event: Event) {
      const targetIndex = (event as CustomEvent<number>).detail;
      if (typeof targetIndex !== "number" || targetIndex === index) return;
      setDirection(targetIndex > index ? 1 : -1);
      setIndex(targetIndex);
    }
    window.addEventListener(GEAR_ARCHIVE_SELECT_EVENT, onSelect);
    return () => window.removeEventListener(GEAR_ARCHIVE_SELECT_EVENT, onSelect);
  }, [index]);

  function handleDragEnd(_event: unknown, info: PanInfo) {
    if (info.offset.x <= -SWIPE_OFFSET_THRESHOLD || info.velocity.x <= -SWIPE_VELOCITY_THRESHOLD) {
      step(1);
    } else if (info.offset.x >= SWIPE_OFFSET_THRESHOLD || info.velocity.x >= SWIPE_VELOCITY_THRESHOLD) {
      step(-1);
    }
  }

  return (
    <section id="arhiv-ekipirovki" className="border-b-2 border-[var(--rule)] bg-[var(--background)] py-16 sm:py-20">
      <Container wide>
        <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
          <div>
            <p className="record-label text-[var(--gold)]">Л. 09 · Архив экипировки</p>
            <h2 className="font-display mt-3 text-3xl font-semibold leading-[1] tracking-[-0.015em] sm:text-[3rem]">
              Экспонаты
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-[1.65] text-[var(--text-3)] sm:text-right">
            Девять предметов обязательного комплекта — независимо от разряда, вытянутого жребием.
          </p>
        </div>

        <div className="relative mt-10 overflow-hidden border border-[var(--border-strong)] bg-[var(--surface-muted)]">
          <span aria-hidden="true" className="tick" style={{ top: 10, left: 10, borderTop: "1.5px solid var(--gold)", borderLeft: "1.5px solid var(--gold)" }} />
          <span aria-hidden="true" className="tick" style={{ top: 10, right: 10, borderTop: "1.5px solid var(--gold)", borderRight: "1.5px solid var(--gold)" }} />
          <span aria-hidden="true" className="tick" style={{ bottom: 10, left: 10, borderBottom: "1.5px solid var(--gold)", borderLeft: "1.5px solid var(--gold)" }} />
          <span aria-hidden="true" className="tick" style={{ bottom: 10, right: 10, borderBottom: "1.5px solid var(--gold)", borderRight: "1.5px solid var(--gold)" }} />

          <div className="flex items-baseline justify-between border-b border-[var(--border)] px-6 py-3 sm:px-8">
            <span className="record-label text-[var(--gold)]">Архив · экипировка</span>
            <span className="record-label text-[var(--muted)]">
              Экспонаты {pad(index)} / {pad(TOTAL - 1)}
            </span>
          </div>

          {/* aria-live announcer — screen readers hear the change even though
              the visual counter above is the same DOM node re-rendering */}
          <p className="sr-only" aria-live="polite">
            Экспонат {pad(index)} из {TOTAL}: {item.title}
          </p>

          <div className="overflow-hidden px-6 py-8 sm:px-8 sm:py-8">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={index}
                custom={direction}
                variants={reduceMotion ? undefined : slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: TURN_EASE }}
                className="grid gap-8 sm:grid-cols-2 sm:items-center sm:gap-8"
              >
                {/* Mobile wants number → title/subtitle → IMAGE → description
                    → nav; desktop wants title+description stacked in one text
                    column beside the image. A `row-span` grid tried first here
                    stretched the row heights to fit the tall image, leaving a
                    large blank gap under the subtitle — a known CSS Grid
                    auto-row-sizing quirk with spanning items. Simpler, robust
                    fix: the description renders twice, each copy hidden on
                    the breakpoint where it isn't needed, rather than fighting
                    grid placement for one shared node. */}
                <div className="order-1 sm:order-1">
                  <span className="font-display text-5xl font-semibold text-[var(--accent)] sm:text-6xl">
                    {pad(index)}
                  </span>
                  <h3 className="font-display mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
                    {item.title}
                  </h3>
                  <p className="record-label mt-1.5 text-[var(--gold)]">{item.subtitle}</p>
                  <p className="mt-4 hidden max-w-md text-sm leading-[1.7] text-[var(--text-3)] sm:block">{item.desc}</p>
                </div>

                <div className="order-2 sm:order-2">
                  <motion.div
                    className="relative mx-auto aspect-[4/5] w-full max-w-[340px] cursor-grab touch-pan-y overflow-hidden border border-[var(--border)] active:cursor-grabbing"
                    drag={reduceMotion ? false : "x"}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.15}
                    onDragEnd={handleDragEnd}
                  >
                    {item.image ? (
                      <>
                        {/* The prepared photos are crops from one composite
                            reference sheet, not individually isolated shots —
                            neighbouring items and an inconsistent studio
                            backdrop bleed in at the edges of nearly every one.
                            Scaling the image up crops that bleed out of frame;
                            the filter mutes each photo's own stray lighting
                            (a few run noticeably red/warm) toward one
                            consistent tone; the vignette fades whatever still
                            reaches the edge into the plate's own background
                            instead of showing a hard photo-edge cutoff. None
                            of this can fully fix a crop that genuinely has no
                            more of the target object to show — ask for
                            tighter individual crops if a specific item still
                            reads wrong after this. */}
                        {/* eslint-disable-next-line @next/next/no-img-element -- project convention: no next/image anywhere, no remote-image config */}
                        <img
                          src={item.image}
                          alt={`${item.title} — ${item.subtitle}`}
                          className="h-full w-full scale-[1.02] object-contain"
                          style={{ objectPosition: "50% 50%", filter: "saturate(0.72) brightness(0.94) contrast(1.04)" }}
                          draggable={false}
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0"
                          style={{ background: "radial-gradient(circle, transparent 52%, var(--surface-muted) 100%)" }}
                        />
                      </>
                    ) : (
                      <ExhibitSwatch index={index} />
                    )}
                  </motion.div>
                </div>

                <p className="order-3 max-w-md text-sm leading-[1.7] text-[var(--text-3)] sm:hidden">{item.desc}</p>

                <div className="order-4 flex items-center justify-between border-t border-[var(--border)] pt-6 sm:order-3 sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="Предыдущий экспонат"
                    className="record-label border border-[var(--border-strong)] px-4 py-2.5 text-[var(--muted)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
                  >
                    ← Назад
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="Следующий экспонат"
                    className="record-label border border-[var(--border-strong)] px-4 py-2.5 text-[var(--muted)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
                  >
                    Следующий →
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Container>
    </section>
  );
}

/**
 * Honest placeholder for every item — none has a dedicated photo yet: a
 * material-sample swatch (fine diagonal weave, the same gold-weave language
 * used elsewhere on the page) behind a large watermark numeral, plus a thin
 * decorative circle. An archival "specimen not yet illustrated" card, not a
 * guess at the object's actual shape.
 */
function ExhibitSwatch({ index }: { index: number }) {
  const uid = useId();
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden border border-[var(--border)]" aria-hidden="true">
      <span
        className="absolute left-1/2 top-1/2 aspect-square w-[112%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--border)]"
        style={{ opacity: 0.4 }}
      />
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full text-[var(--gold)]" style={{ opacity: 0.5 }}>
        <defs>
          <pattern id={`${uid}-swatch`} width="4.2" height="4.2" patternUnits="userSpaceOnUse">
            <path d="M0 4.2 L4.2 0" stroke="currentColor" strokeWidth="0.5" />
            <path d="M0 0 L4.2 4.2" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x="10" y="10" width="80" height="80" fill={`url(#${uid}-swatch)`} />
        <rect x="10" y="10" width="80" height="80" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
      </svg>
      <span className={cn("font-display relative text-[4.5rem] font-semibold text-[var(--muted)]")} style={{ opacity: 0.28 }}>
        {pad(index)}
      </span>
    </div>
  );
}
