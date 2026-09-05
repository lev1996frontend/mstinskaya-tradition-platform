"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AnchorIcon } from "@/components/brand/anchor-icon";
import { AnnalIcon } from "@/components/brand/annal-icon";
import { BoatIcon } from "@/components/brand/boat-icon";
import { BratinaIcon } from "@/components/brand/bratina-icon";
import { PaintingIcon } from "@/components/brand/painting-icon";
import { Emblem } from "@/components/brand/emblem";
import { StenkaIcon } from "@/components/brand/weapon-glyphs";
import { useBuza } from "@/features/home/buza-context";

/**
 * Мста — the river the tradition (and this archive) is named after, run down
 * the page's own margin as its spine.
 *
 * One hairline meander in the outer margin, with a boat (`BoatIcon`) carrying
 * the reader's position down it. The header once ran the same river across, as
 * a strip; that strip is gone — it cost a second storey of header on every
 * phone to offer a button for a section further down the page — so this is now
 * the only river on the site. So the background
 * stops being decoration and starts answering "how far into this document am
 * I, and what have I passed" — the notches are the real `<section id>`
 * boundaries of whatever page is mounted, measured, not decorative marks at
 * pretty intervals.
 *
 * Margin only, and only from `lg` up: the rail is sized to sit inside the page
 * gutter (24px at lg, where `Container`'s own `px-6` is the whole margin, wider
 * once there's real gutter to spend), so a 1px line never crosses a text
 * column. Below `lg` there is no margin to run a river down, and the page keeps
 * the light/weave/grain layers instead.
 */

/** Path space. Stretched to the rail's real box with `preserveAspectRatio:
 *  none`, so the meander squashes to the margin's width while keeping its full
 *  vertical travel — the amplitude below is written generously for exactly that
 *  ~3× horizontal squash. */
const VB_W = 88;
const VB_H = 1000;

type Point = { x: number; y: number };
type Cubic = { c1: Point; c2: Point; to: Point };

/**
 * Русло. Kept as data rather than a `d` string because the same numbers have
 * to serve twice: once as the drawn path, and once as a curve this module
 * samples in plain arithmetic (below) to find where the water is at a given
 * height. Sampling the DOM path with `getPointAtLength` would tie every
 * measurement to the SVG being mounted first — which it isn't on the render
 * that decides whether to mount at all.
 *
 * Six bends, all descending: monotonic in Y is what lets the lookup below be
 * a binary search on height, and progress has to map to *vertical* position to
 * read as progress. Squashed into a ~56px margin a lazier wave flattens into
 * what looks like a plain vertical rule, so it has to turn this often to still
 * read as water.
 */
const RIVER_FROM: Point = { x: 44, y: 0 };
const RIVER_CURVE: Cubic[] = [
  { c1: { x: 72, y: 58 }, c2: { x: 16, y: 108 }, to: { x: 42, y: 170 } },
  { c1: { x: 68, y: 232 }, c2: { x: 14, y: 278 }, to: { x: 40, y: 342 } },
  { c1: { x: 66, y: 404 }, c2: { x: 16, y: 452 }, to: { x: 44, y: 516 } },
  { c1: { x: 72, y: 578 }, c2: { x: 18, y: 626 }, to: { x: 42, y: 690 } },
  { c1: { x: 66, y: 750 }, c2: { x: 14, y: 798 }, to: { x: 40, y: 858 } },
  { c1: { x: 62, y: 912 }, c2: { x: 30, y: 954 }, to: { x: 46, y: VB_H } },
];

const RIVER_D = `M ${RIVER_FROM.x} ${RIVER_FROM.y} ${RIVER_CURVE.map(
  (seg) => `C ${seg.c1.x} ${seg.c1.y}, ${seg.c2.x} ${seg.c2.y}, ${seg.to.x} ${seg.to.y}`,
).join(" ")}`;

const STEPS_PER_BEND = 64;

/** The curve as a height→point table, built once at module load. */
const RIVER_SAMPLES: Point[] = (() => {
  const out: Point[] = [];
  let from = RIVER_FROM;
  for (const seg of RIVER_CURVE) {
    for (let i = 1; i <= STEPS_PER_BEND; i += 1) {
      const t = i / STEPS_PER_BEND;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      out.push({
        x: a * from.x + b * seg.c1.x + c * seg.c2.x + d * seg.to.x,
        y: a * from.y + b * seg.c1.y + c * seg.c2.y + d * seg.to.y,
      });
    }
    from = seg.to;
  }
  return out;
})();

/** Where the water is at a given height. Binary search, valid only because
 *  the curve above descends throughout. */
function riverAtY(y: number): Point {
  let lo = 0;
  let hi = RIVER_SAMPLES.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (RIVER_SAMPLES[mid].y < y) lo = mid + 1;
    else hi = mid;
  }
  return RIVER_SAMPLES[lo];
}

/** Below this there is no journey to chart, so the rail stays out entirely — a
 *  short page (an empty registry, a login form) would otherwise get a river
 *  with the boat pinned at the source. */
const MIN_SCROLLABLE = 420;

/** Half-length of a bank notch, in path units. */
const NOTCH = 8;

/**
 * Знаки на воде. Four marks standing in the current, each one a way into the
 * section it stands for — the shield to "Буза", the wall to "Стенка и круг",
 * the leaf to "Хроника", the easel to "Живопись".
 *
 * They used to be something else: three bays (затон/застава/пристань) carrying
 * the header strip's own three symbols (boat/seal/mug), all three opening the
 * same section, because all three were readings of one word. That left the rail
 * saying one thing three times while the page below it had four other places
 * worth reaching, and put the boat in two jobs at once — the reader's position
 * *and* a button. Now the strip keeps the etymology and the rail carries the
 * page: one mark per real destination, each with its own glyph, and the boat
 * does nothing but show where you are.
 *
 * Each mark gets an equal stretch of river and the whole rail is read through
 * that same chart (see `chart`), so a mark, its notch and the boat can never
 * drift apart — the boat arrives at a mark exactly as the reader reaches the
 * section it stands for.
 */
type Mark = {
  /** The `<section id>` this mark stands on and scrolls to. */
  id: string;
  label: string;
  /** What the place is, in the archive's own voice — shown on hover/focus. */
  note: string;
};

const MARKS: Mark[] = [
  { id: "buza", label: "Буза", note: "Откуда слово" },
  { id: "stenka", label: "Стенка и круг", note: "Как сходятся" },
  { id: "hronika", label: "Хроника", note: "Что уже было" },
  { id: "zhivopis", label: "Живопись", note: "Как это видели" },
];

/**
 * Братина — the last thing on the river, and the only mark that isn't a way
 * anywhere: it takes no section, scrolls nowhere, and answers a click with the
 * drink moving in it. The "напиток" reading of the word is the one the rail
 * would otherwise have dropped when the bays became section anchors, and it's
 * the reading that can't be a destination — you don't navigate to a drink.
 *
 * A братина rather than the strip's mug: this one was passed round the circle
 * hand to hand, which is why it has a handle on each side, and why it stands at
 * the end of the voyage — the sluice over, the vessel going round.
 */
const BRATINA: Mark = { id: "bratina", label: "Братина", note: "Пили по кругу" };

/** What goes over the rim when the братина is handed on: three drops from the
 *  two lips, thrown a beat apart so they read as a spill and not a pulse. The
 *  keyframe itself is `.bratina-drop` in globals.css. */
const BRATINA_DROPS = [
  { left: "4px", top: "6px", x: "-9px", delay: "0ms" },
  { left: "26px", top: "7px", x: "8px", delay: "90ms" },
  { left: "7px", top: "8px", x: "-4px", delay: "190ms" },
];

/**
 * Каждому знаку свой материал. Four marks on one hairline river will read as
 * one ochre family unless they're made of different things: red wax for the
 * shield (the seal), brass for the wall (a fight is metal), cold tin for the
 * chronicle (a stamped plate), and linen for the paintings — the canvas is the
 * one object here that isn't metal at all.
 */
const MARK_MATERIAL: Record<string, string> = {
  stenka: "border-[var(--gold)]/45 text-[var(--gold)]",
  hronika: "border-[var(--chrome)]/45 text-[var(--chrome)]",
  zhivopis: "border-[var(--surface-paper)]/40 text-[var(--surface-paper)]",
  bratina: "border-[var(--copper)]/50 text-[var(--copper)]",
};

/** The rail's own width once it carries marks (`.river-rail.is-bayed` in
 *  globals.css, 4rem past ~1400px). Read here in px because a mark has to be
 *  kept whole inside it — see the clamp in the component. */
const RAIL_W = 64;

/** Outer box of a mark, plate plus the water going round it. The shield is the
 *  biggest thing the rail can hold; the glyph plates are smaller so four marks
 *  never crowd the same stretch of water. */
const SHIELD_BOX = 54;
const GLYPH_BOX = 44;

/** How near a mark the boat has to be, in charted progress, before it puts in
 *  instead of sailing past. */
const DOCK_REACH = 0.07;

/**
 * Разметка. Real sections don't fall at comfortable intervals — on the homepage
 * "Буза" and "Стенка" start ~5% apart while the rest of the page runs on for
 * half its height, which put two marks on top of each other and left the last
 * two crowded into the bottom third.
 *
 * So the river is charted rather than scaled: each marked section gets an equal
 * stretch of water, and everything that rides the river — the boat, the notches,
 * the travelled-water clip and the marks themselves — is placed through the same
 * mapping. Scroll speed along the rail changes between sections (a long section
 * passes slowly), which is the point: the rail measures the document in
 * *places*, not in pixels, and the boat therefore arrives at a mark exactly when
 * the reader reaches that section. Pushing marks apart by hand instead (an
 * earlier attempt) moved the mark but not the boat, so the boat sailed past a
 * berth that was drawn somewhere else.
 */
type Stop = { from: number; to: number };

function chart(progress: number, stops: Stop[]): number {
  if (stops.length === 0) return progress;
  let prev: Stop = { from: 0, to: 0 };
  for (const stop of stops) {
    if (progress < stop.from) {
      const span = stop.from - prev.from;
      return prev.to + (stop.to - prev.to) * (span > 0 ? (progress - prev.from) / span : 0);
    }
    prev = stop;
  }
  const span = 1 - prev.from;
  return prev.to + (1 - prev.to) * (span > 0 ? (progress - prev.from) / span : 0);
}

type Tick = { id: string; progress: number };

/**
 * Обтекание — the water going round a mark. Two arcs hugging the mark's plate,
 * left and right, so the current reads as parting at the stone and closing
 * behind it instead of running straight through the glyph.
 *
 * Drawn here, in the mark's own square box, rather than in the rail's SVG: that
 * one is stretched (`preserveAspectRatio: none`, a ~3× horizontal squash), so a
 * circle drawn in it comes out an oval and a hairline arc comes out uneven. In
 * an unstretched box the arcs are honest circles.
 *
 * They stop short of the poles (55° either side of the horizontal) on purpose.
 * A pair of full half-circles would meet the river exactly top and bottom
 * centre, and the real channel wanders — it arrives a few pixels off, and the
 * mismatch at the join reads as a broken line. Short arcs beside the stone
 * never claim to join anything.
 */
function MarkWater({ radius }: { radius: number }) {
  const box = radius * 2 + 8;
  const c = box / 2;
  const dx = radius * Math.sin((55 * Math.PI) / 180);
  const dy = radius * Math.cos((55 * Math.PI) / 180);
  return (
    <svg
      aria-hidden="true"
      width={box}
      height={box}
      viewBox={`0 0 ${box} ${box}`}
      fill="none"
      className="pointer-events-none absolute"
    >
      <path
        d={`M ${c - dx} ${c - dy} A ${radius} ${radius} 0 0 0 ${c - dx} ${c + dy}`}
        stroke="var(--chrome)"
        strokeWidth="1"
        opacity="0.3"
      />
      <path
        d={`M ${c + dx} ${c - dy} A ${radius} ${radius} 0 0 1 ${c + dx} ${c + dy}`}
        stroke="var(--chrome)"
        strokeWidth="1"
        opacity="0.3"
      />
    </svg>
  );
}

export function RiverSpine() {
  const pathname = usePathname();
  const { open, openWith } = useBuza();
  const railRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<SVGRectElement>(null);
  const boatRef = useRef<HTMLDivElement>(null);
  const railSizeRef = useRef({ w: 0, h: 0 });
  /* Where the boat can put in, in the shape `render`'s per-frame loop wants:
     a ref, because that loop runs outside React and must not be rebuilt every
     time a mark shifts by a pixel. Filled from `marks` below. */
  const marksRef = useRef<{ id: string; at: number; x: number }[]>([]);
  /* The chart the boat and the notches are read against — see `chart`. */
  const stopsRef = useRef<Stop[]>([]);
  /* Which mark the boat is lying at, if any. Set from the scroll loop but
     kept as state, since the mark has to step aside and its pool has to show:
     that's a render, not a transform write. Only changes on arrival and
     departure, so it costs one render each way, not one per frame. */
  const berthedRef = useRef<string | null>(null);
  const [berthed, setBerthed] = useState<string | null>(null);
  /* The братина: `drained` is what's in it, `sloshing` is the moment of it
     moving. Two flags rather than one, because the level has to survive the
     animation — drunk to the bottom, it stays empty until someone fills it. */
  const [sloshing, setSloshing] = useState(false);
  const [drained, setDrained] = useState(false);
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [charted, setCharted] = useState(false);

  /* The marks stand on the homepage's own sections, so they only exist there —
     the same gate `site-header.tsx` puts on the river strip, for the same
     reason: elsewhere they'd point at nothing.

     They also need a margin wide enough to hold them, and that threshold has
     to be the *same* one that hides the header strip, or the symbols end up on
     screen twice at once (they did, at 1280). Matched in JS rather than hidden
     in CSS so the marks simply aren't in the DOM below it — nothing to tab
     into, nothing to mis-hide. */
  const [roomy, setRoomy] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1400px)");
    const sync = () => setRoomy(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const bayed = pathname === "/" && roomy;
  /* Only the shield plays an impact, so one flag covers it. */
  const [struck, setStruck] = useState(false);

  /* A mark is a way *into* its section: it scrolls there, and "Буза" — which is
     collapsed until something opens it — is opened first, on this mark's own
     reading of the word, so the reader doesn't arrive at a closed door. It
     never closes the section: the mark is an anchor, and an anchor that
     sometimes shuts what it points at would be lying about where it leads.
     Closing stays with the header strip's symbols and the section's own
     control. */
  const goToMark = useCallback(
    (id: string) => {
      if (id === "buza" && !open) openWith("buyat");
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [open, openWith],
  );

  /* The rail's own box, measured once per layout change rather than once per
     frame: reading `clientWidth`/`clientHeight` between the transform writes
     in `render` would force a reflow on every tick of a smooth-scrolled page. */
  const measureRail = useCallback(() => {
    const rail = railRef.current;
    if (rail) railSizeRef.current = { w: rail.clientWidth, h: rail.clientHeight };
  }, []);

  const render = useCallback(() => {
    const boat = boatRef.current;
    const clip = clipRef.current;
    if (!boat || !clip) return;

    const max = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    /* Charted, not raw: the rail measures the document in places (see `chart`). */
    const progress = chart(scrolled, stopsRef.current);
    const here = riverAtY(progress * VB_H);

    const { w, h } = railSizeRef.current;
    let x = (here.x / VB_W) * w;
    let y = (here.y / VB_H) * h;

    /* Швартовка: coming up on a mark the boat puts in and lies there while the
       reader is inside that section, getting under way again on the far side.
       `pull` is 0 at the edge of reach and 1 dead level with the mark, eased so
       the turn in and out has no corner. Nearest mark wins where two reaches
       overlap — pulled two ways at once, the boat would sit between them,
       moored to neither. */
    let moored = 0;
    let at: string | null = null;
    for (const berth of marksRef.current) {
      const gap = Math.abs(progress - berth.at);
      if (gap >= DOCK_REACH) continue;
      const pull = 1 - gap / DOCK_REACH;
      const eased = pull * pull * (3 - 2 * pull);
      if (eased <= moored) continue;
      moored = eased;
      x = x + (berth.x - x) * eased;
      y = y + (berth.at * h - y) * eased;
      if (eased > 0.5) at = berth.id;
    }

    if (berthedRef.current !== at) {
      berthedRef.current = at;
      setBerthed(at);
    }

    /* Lean into the bend rather than turning to face down the current: a
       side-view hull rotated to point straight down reads as a wreck, not a
       boat under way. Moored, it squares up — a boat at rest sits level. */
    const ahead = riverAtY(Math.min(VB_H, progress * VB_H + 26));
    const lean = Math.max(-13, Math.min(13, (ahead.x - here.x) * 0.85)) * (1 - moored);
    boat.style.transform = `translate3d(calc(${x}px - 50%), calc(${y}px - 50%), 0) rotate(${lean}deg)`;

    /* Travelled water is clipped, not dashed: a rect clip stays correct under
       the rail's non-uniform scaling, where dash offsets in user units would
       not — and it colours the passed notches for free, since the gold copy of
       the whole set rides inside the same clip. */
    clip.setAttribute("height", `${progress * VB_H}`);
  }, []);

  /* Chart the page: how far it scrolls, and where its real sections fall on
     that scroll. Re-run on route change and whenever the document resizes —
     images and streamed server content land after mount and move every
     boundary measured before them. */
  useEffect(() => {
    const chart = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max < MIN_SCROLLABLE) {
        setCharted(false);
        setTicks([]);
        return;
      }
      setCharted(true);
      setTicks(
        Array.from(document.querySelectorAll<HTMLElement>("main section[id]")).map((section) => ({
          id: section.id,
          progress: Math.min(1, Math.max(0, (section.getBoundingClientRect().top + window.scrollY) / max)),
        })),
      );
    };

    chart();
    const observer = new ResizeObserver(chart);
    observer.observe(document.body);
    window.addEventListener("resize", chart);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", chart);
    };
  }, [pathname]);

  useEffect(() => {
    if (!charted) return;
    measureRail();
    render();
  }, [charted, measureRail, render]);

  useEffect(() => {
    if (!charted) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        render();
      });
    };
    const onResize = () => {
      measureRail();
      onScroll();
    };
    onScroll();
    /* Native scroll, not a Lenis callback: Lenis keeps `window.scrollY` in sync
       every frame and is skipped entirely under reduced motion, so this stays
       correct in both branches (same reasoning as `scroll-to-top.tsx`). */
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [charted, measureRail, render]);

  /* Знаки. Only where there's margin to hold them: a mark needs ~64px of rail,
     and the homepage's own `Container wide` (max-w-7xl) leaves that only past
     ~1400px. Below it the rail stays the plain hairline it is elsewhere and the
     header strip keeps its three symbols (`site-header.tsx` mirrors this
     breakpoint), so nothing is ever in two places at once.

     A mark only appears once its section has actually been measured — no
     section on the page, no mark, rather than a mark standing over water it
     can't take you to. */
  const marks = useMemo<(Mark & { left: number; riverX: number; top: number; box: number })[]>(() => {
    const placed: (Mark & { left: number; riverX: number; top: number; box: number })[] = [];
    if (!bayed) return placed;
    const found = MARKS.map((mark) => ({
      mark,
      progress: ticks.find((candidate) => candidate.id === mark.id)?.progress,
    })).filter((entry): entry is { mark: Mark; progress: number } => entry.progress !== undefined);

    /* Equal stretches of water, one per place on the river — the marked
       sections and then the братина at the end — with a margin above the first
       and below the last so the boat has somewhere to come from and somewhere
       to go. */
    const places = found.length + 1;
    found.forEach((entry, index) => {
      const at = (index + 1) / (places + 1);
      const box = entry.mark.id === "buza" ? SHIELD_BOX : GLYPH_BOX;
      const half = box / 2;
      const riverX = (riverAtY(at * VB_H).x / VB_W) * RAIL_W;
      /* The mark follows the water sideways, but only as far as the rail can
         hold it: centred on the channel at a bend it would hang half off the
         page edge, since the meander swings wider than 64px. */
      placed.push({ ...entry.mark, box, riverX, left: Math.min(RAIL_W - half, Math.max(half, riverX)), top: at * 100 });
    });

    if (found.length > 0) {
      const at = places / (places + 1);
      const riverX = (riverAtY(at * VB_H).x / VB_W) * RAIL_W;
      const half = GLYPH_BOX / 2;
      placed.push({
        ...BRATINA,
        box: GLYPH_BOX,
        riverX,
        left: Math.min(RAIL_W - half, Math.max(half, riverX)),
        top: at * 100,
      });
    }
    return placed;
  }, [bayed, ticks]);

  /* The chart itself: each marked section's real scroll position mapped to its
     even stretch of rail. The братина is left out — it stands on the river but
     isn't a section, so it can't be a point the chart is pinned to. */
  const stops = useMemo<Stop[]>(
    () =>
      marks
        .filter((mark) => mark.id !== BRATINA.id)
        .map((mark) => ({
          from: ticks.find((tick) => tick.id === mark.id)?.progress ?? mark.top / 100,
          to: mark.top / 100,
        })),
    [marks, ticks],
  );

  /* The boat's berths follow the marks, at the position they're actually drawn
     at — after the minimum-gap nudge, not the raw section boundary, so it moors
     alongside the plate the reader can see rather than a few pixels off it. */
  /* Both handed to the scroll loop through refs, because that loop runs outside
     React and must not be rebuilt every time a mark shifts by a pixel. Written
     in an effect, never during render: a ref written while rendering is a lie to
     anything that reads it in the same pass.

     The berth is the mark's own centre, which is where its pool is drawn — not
     the raw channel position, which is clamped away from it wherever the
     meander swings wider than the rail. Off by those few pixels, the boat came
     to rest just off-centre in its own circle. */
  useEffect(() => {
    marksRef.current = marks.map((mark) => ({ id: mark.id, at: mark.top / 100, x: mark.left }));
    stopsRef.current = stops;
    render();
  }, [marks, stops, render]);

  if (!charted) return null;

  /* Пороги — one notch per real section boundary, cut into the bank where the
     water actually runs at that height. Drawn twice, waiting and passed, with
     the passed copy inside the travelled-water clip so it lights up as the
     boat goes by without any per-frame work. */
  const notches = ticks.map((tick) => {
    const y = chart(tick.progress, stops) * VB_H;
    return { id: tick.id, x: riverAtY(y).x, y };
  });

  return (
    <div
      ref={railRef}
      className={`river-rail pointer-events-none fixed top-20 bottom-10 left-0 z-[5] hidden lg:block${
        bayed ? " is-bayed" : ""
      }`}
    >
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <clipPath id="river-spine-travelled">
            <rect ref={clipRef} x="0" y="0" width={VB_W} height="0" />
          </clipPath>
        </defs>

        {/* Русло — the whole course, waiting. Struck in the cold ramp's light
            end at low alpha rather than `--chrome-line` itself: that token is
            dark enough against the coal ground to vanish outright, which left
            the river looking like it simply stopped under the boat instead of
            running on ahead of it. */}
        <path d={RIVER_D} stroke="var(--chrome)" strokeWidth="1" opacity="0.16" vectorEffect="non-scaling-stroke" />

        {notches.map((notch) => (
          <line
            key={notch.id}
            x1={notch.x - NOTCH}
            x2={notch.x + NOTCH}
            y1={notch.y}
            y2={notch.y}
            stroke="var(--chrome)"
            strokeWidth="1"
            opacity="0.22"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Пройденное — the same water, behind you. */}
        <g clipPath="url(#river-spine-travelled)">
          <path d={RIVER_D} stroke="var(--gold)" strokeWidth="1" opacity="0.55" vectorEffect="non-scaling-stroke" />
          {notches.map((notch) => (
            <line
              key={notch.id}
              x1={notch.x - NOTCH}
              x2={notch.x + NOTCH}
              y1={notch.y}
              y2={notch.y}
              stroke="var(--gold)"
              strokeWidth="1"
              opacity="0.6"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      </svg>

      {/* Затоны — the water a mark opens into. Same circle as the mark's own
          plate, in the same place: what the reader sees is one shape that was a
          mark and is now a berth, rather than two objects trading places. Drawn
          only while the boat is lying in it. */}
      {marks.map((mark) => (
        <span
          key={`pool-${mark.id}`}
          aria-hidden="true"
          className={`river-pool${berthed === mark.id ? " is-open" : ""}`}
          style={{
            left: `${mark.left}px`,
            top: `${mark.top}%`,
            width: mark.box - 4,
            height: mark.box - 4,
          }}
        />
      ))}

      {/* Знаки на воде — one per section, standing where that section's stretch
          of river begins. Each is opaque, so the hairline river disappears
          behind it and the water is drawn parting around it instead
          (`MarkWater`): the line no longer runs through the middle of a glyph.
          A mark opens as the boat comes up to it — widening out and going,
          leaving its own circle behind as the berth the boat lies in. So the
          rail reads as one line of places being reached one after another,
          instead of plates shuffling out of the boat's way. */}
      {marks.map((mark) => {
        const isShield = mark.id === "buza";
        const isBratina = mark.id === BRATINA.id;
        /* Opened: the boat is here, the mark has given way to its berth. It's
           gone visually, so it's out of the tab order and off the tree too —
           an invisible control that still answers the keyboard is a trap. */
        const opened = berthed === mark.id;
        return (
          <button
            key={mark.id}
            type="button"
            onClick={() => {
              if (isBratina) {
                /* До дна, then filled again on the next click. */
                setDrained((was) => !was);
                setSloshing(true);
                return;
              }
              goToMark(mark.id);
              if (isShield) setStruck(true);
            }}
            /* Only the shield's target is a thing that opens; the other two
               marks are plain jumps, so they claim no expanded state. */
            aria-expanded={isShield ? open : undefined}
            aria-controls={isShield ? "buza" : undefined}
            aria-label={
              isBratina
                ? drained
                  ? "Братина — пуста, налить"
                  : "Братина — выпить до дна"
                : `${mark.label} — ${mark.note.toLowerCase()}`
            }
            onAnimationEnd={(event) => {
              if (event.animationName === "strike-ring") setStruck(false);
              /* Cleared on the vessel's own movement, not the liquid's: the
                 liquid only animates on the way *in*, so listening to the slosh
                 alone left the flag stuck after a drink. */
              if (event.animationName === "bratina-tip" || event.animationName === "bratina-rock") setSloshing(false);
            }}
            className={`river-berth pointer-events-auto absolute grid cursor-pointer place-items-center border-0 bg-transparent p-0${
              isShield && open ? " shield-on-guard" : ""
            }${opened ? " river-berth-open" : ""}`}
            style={{ left: `${mark.left}px`, top: `${mark.top}%`, width: mark.box, height: mark.box }}
            aria-hidden={opened || undefined}
            tabIndex={opened ? -1 : undefined}
          >
            <span
              className="river-bob relative grid place-items-center"
              style={{ width: mark.box, height: mark.box }}
            >
              <MarkWater radius={mark.box / 2 - 4} />
              {isShield ? (
                /* Takes the blow and holds the guard rather than breaking: this
                   mark is meant to be hit again on every visit, and while «Буза»
                   is open it keeps a visible posture instead of a visible wound.
                   The same pose the section's own emblem button now strikes, so
                   the two read as one gesture in two places. Big enough (40px)
                   to carry the real mark. */
                <>
                  <span className={`shield-guard grid place-items-center${open ? " shield-guard-raised" : ""}`}>
                    <span className={`grid place-items-center${struck ? " shield-brace" : ""}`}>
                      {/* Colour stated rather than inherited: the mark is
                          `currentColor`, and a berth that changes text colour
                          later must not silently repaint the emblem with it. */}
                      <Emblem size={40} className="text-[var(--foreground)]" />
                    </span>
                  </span>
                  {struck ? (
                    <span aria-hidden="true" className="strike-ring pointer-events-none absolute inset-0 m-auto size-6" />
                  ) : null}
                </>
              ) : (
                /* Each mark its own material, so they never read as one ochre
                   family: red wax for the shield, brass for the wall, cold tin
                   for the chronicle and the paintings. */
                <span
                  className={`grid size-8 place-items-center rounded-full border ${MARK_MATERIAL[mark.id] ?? MARK_MATERIAL.hronika}`}
                  style={{ background: "var(--background-deep)", boxShadow: "var(--shadow-sm)" }}
                >
                  {mark.id === "stenka" ? (
                    <StenkaIcon size={18} />
                  ) : mark.id === "hronika" ? (
                    <AnnalIcon size={18} />
                  ) : isBratina ? (
                    <span
                      className={`relative grid place-items-center${
                        sloshing ? (drained ? " bratina-tip" : " bratina-rock") : ""
                      }`}
                    >
                      {/* The liquid only sloshes on the way in — draining, it's
                          leaving the bowl, and a surface swinging about while
                          the level drops reads as two different things
                          happening to one drink. */}
                      <BratinaIcon size={22} drained={drained} sloshing={sloshing && !drained} />
                      {sloshing && drained
                        ? BRATINA_DROPS.map((drop, index) => (
                            <span
                              key={index}
                              aria-hidden="true"
                              className="bratina-drop"
                              style={{
                                left: drop.left,
                                top: drop.top,
                                animationDelay: drop.delay,
                                ...({ "--drop-x": drop.x } as Record<string, string>),
                              }}
                            />
                          ))
                        : null}
                    </span>
                  ) : (
                    <PaintingIcon size={18} />
                  )}
                </span>
              )}
            </span>
            <span className="river-berth-label record-label">
              {mark.label}
              <span className="block text-[var(--text-4)]">{mark.note}</span>
            </span>
          </button>
        );
      })}

      {/* Кораблик — the reader's own position on the water, and nothing else.
          It used to be a button too, opening "Буза" when clicked at the затон:
          two different meanings on one glyph (where you are / what this opens),
          and clicking a bay moved the boat there anyway, so the boat looked
          like a control that had just been used. It's a read-out now — inert,
          `aria-hidden`, no hover label. The marks beside the water are the
          things you click. */}
      <div ref={boatRef} aria-hidden="true" className="absolute top-0 left-0 will-change-transform">
        {/* The 0.85 sits on the hull alone, not on the wrapper: it used to dim
            the whole group, and the anchor — already small, thin and in cold
            metal against a dark pool — went with it. */}
        <span className="river-bob relative block">
          <span className="block text-[var(--gold)] opacity-85">
            <BoatIcon size={21} />
          </span>

          {/* Якорь на канате — hung off the hull itself, inside the bobbing
              wrapper, so the line rides the water with the boat instead of
              standing still beside a moving hull. Dropped only while the boat
              is lying in a berth, and gone the moment it gets under way: rope
              and anchor belong to a boat at rest. */}
          <span className={`river-anchor${berthed ? " is-down" : ""}`}>
            {/* Five pixels of rope, measured rather than guessed: at eight the
                flukes hung three past the pool's rim. */}
            <svg className="river-rode" width="7" height="5" viewBox="0 0 7 5" fill="none" aria-hidden="true">
              <path d="M3.5 0 C 5.3 1.6, 1.7 3.2, 3.5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="river-anchor-fluke">
              <AnchorIcon size={11} />
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}
