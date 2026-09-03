"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { BoatIcon } from "@/components/brand/boat-icon";
import { MugIcon } from "@/components/brand/mug-icon";
import { SealDisc } from "@/components/brand/seal-disc";
import { useBuza, type BuzaVersion } from "@/features/home/buza-context";

/**
 * Мста — the river the tradition (and this archive) is named after, run down
 * the page's own margin as its spine.
 *
 * The header already shows the river across (`river-strip.tsx`, a horizontal
 * current with the Буза boat on it). This is the same river seen along: one
 * hairline meander in the outer margin, with the same boat (`BoatIcon`, shared
 * with that strip) carrying the reader's position down it. So the background
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
 * Три затона. The header strip's three symbols, moved onto the river as places
 * along it — which is what they were describing all along: the "корабль"
 * reading in `buza.tsx` has the challenge called from the deck "пока лодки
 * ждали очереди в затоне", and the "напиток" one has the artel marking "конец
 * сплава". The bays put those two words back on the water, and the seal's
 * "буянить" between them as the place the quarrel was actually settled.
 *
 * Ordered as the day ran, not as the chips are listed: the boats wait their
 * turn in the затон and the challenge goes up (`korabl`), it is settled at the
 * застава (`buyat`), and the sluice ends at the пристань (`drink`).
 *
 * `korabl` carries no symbol of its own — the boat that sails the reader's
 * scroll position down the river *is* that symbol, and it moors here when the
 * reader gets this far (see `DOCK_REACH`). Drawing a second boat parked in the
 * bay was the whole thing worth avoiding: one river, one boat.
 */
const BAY_OFFSET = 15;

type Bay = {
  version: BuzaVersion;
  at: number;
  label: string;
  /** What the bay is, in the archive's own voice — shown on hover/focus. */
  note: string;
};

const BAYS: Bay[] = [
  { version: "korabl", at: 0.3, label: "Затон", note: "Лодки ждут очереди" },
  { version: "buyat", at: 0.55, label: "Застава", note: "Здесь решают спор" },
  { version: "drink", at: 0.8, label: "Пристань", note: "Конец сплава" },
];

/** How near the boat has to be, in scroll progress, before it puts in at the
 *  затон rather than sailing past it. */
const DOCK_REACH = 0.07;

/** Where a bay sits, in path space: off the channel by `BAY_OFFSET`, always
 *  toward whichever side of the rail has room for it. */
function bayPoint(at: number): Point {
  const on = riverAtY(at * VB_H);
  return { x: on.x + (on.x > VB_W / 2 ? -BAY_OFFSET : BAY_OFFSET), y: on.y };
}

type Tick = { id: string; progress: number };

export function RiverSpine() {
  const pathname = usePathname();
  const { open, toggle, openWith } = useBuza();
  const railRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<SVGRectElement>(null);
  const boatRef = useRef<HTMLDivElement>(null);
  const railSizeRef = useRef({ w: 0, h: 0 });
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [charted, setCharted] = useState(false);

  /* The bays open "Буза", which only exists on the homepage — the same gate
     `site-header.tsx` puts on the river strip, for the same reason: elsewhere
     none of the three would have anything to open.

     They also need a margin wide enough to hold them, and that threshold has
     to be the *same* one that hides the header strip, or the three symbols end
     up on screen twice at once (they did, at 1280). Matched in JS rather than
     hidden in CSS so the bays simply aren't in the DOM below it — nothing to
     tab into, nothing to mis-hide. */
  const [roomy, setRoomy] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1400px)");
    const sync = () => setRoomy(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const bayed = pathname === "/" && roomy;

  /* Opening lands on the bay's own reading of the word; a second click on an
     already-open section closes it, so a bay stays a toggle rather than a
     one-way door. */
  const enterBay = useCallback(
    (version: BuzaVersion) => {
      if (open) toggle();
      else openWith(version);
    },
    [open, toggle, openWith],
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
    const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    const here = riverAtY(progress * VB_H);

    /* Швартовка: near its own затон the boat leaves the channel and puts in,
       easing sideways into the bay instead of sailing straight past the place
       the "корабль" reading is about. `pull` is 0 at the edge of reach and 1
       dead level with the bay, so it arrives and leaves under way rather than
       snapping in. */
    const dock = bayed ? BAYS.find((bay) => bay.version === "korabl") : undefined;
    let cx = here.x;
    let cy = here.y;
    let moored = 0;
    if (dock) {
      const gap = Math.abs(progress - dock.at);
      if (gap < DOCK_REACH) {
        const pull = 1 - gap / DOCK_REACH;
        /* Smoothstep, so the turn in and out of the bay has no corner. */
        moored = pull * pull * (3 - 2 * pull);
        const berth = bayPoint(dock.at);
        cx = here.x + (berth.x - here.x) * moored;
        cy = here.y + (berth.y - here.y) * moored;
      }
    }

    const { w, h } = railSizeRef.current;
    const x = (cx / VB_W) * w;
    const y = (cy / VB_H) * h;

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
  }, [bayed]);

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

  if (!charted) return null;

  /* Пороги — one notch per real section boundary, cut into the bank where the
     water actually runs at that height. Drawn twice, waiting and passed, with
     the passed copy inside the travelled-water clip so it lights up as the
     boat goes by without any per-frame work. */
  const notches = ticks.map((tick) => {
    const bank = riverAtY(tick.progress * VB_H);
    return { id: tick.id, x: bank.x, y: tick.progress * VB_H };
  });

  /* Заводи. Only where there's margin to hold them: the bays need ~64px of
     rail, and the homepage's own `Container wide` (max-w-7xl) leaves that only
     past ~1400px. Below it the rail stays the plain hairline it is elsewhere
     and the header strip keeps the three symbols (`site-header.tsx` mirrors
     this breakpoint), so nothing is ever in two places at once. */
  const bays = bayed ? BAYS.map((bay) => ({ ...bay, point: bayPoint(bay.at) })) : [];

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

        {/* Заводь — the channel opening out beside itself, drawn as the water
            it is: a filled pool over the ground with a lit rim, and a short
            neck joining it to the current so it reads as fed by the river
            rather than parked next to it. */}
        {bays.map((bay) => {
          const on = riverAtY(bay.at * VB_H);
          return (
            <g key={bay.version} className="river-bay">
              <line
                x1={on.x}
                y1={on.y}
                x2={bay.point.x}
                y2={bay.point.y}
                stroke="var(--chrome)"
                strokeWidth="1"
                opacity="0.18"
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx={bay.point.x}
                cy={bay.point.y}
                rx="13"
                ry="20"
                fill="var(--background-deep)"
                stroke="var(--chrome)"
                strokeWidth="1"
                opacity="0.34"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}

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

      {/* Застава и пристань стоят на месте; затон стоит пустым — его знак
          приплывает сам (see `BAYS`). */}
      {bays
        .filter((bay) => bay.version !== "korabl")
        .map((bay) => (
          <button
            key={bay.version}
            type="button"
            onClick={() => enterBay(bay.version)}
            aria-expanded={open}
            aria-controls="buza"
            aria-label={
              open ? "Свернуть раздел «Буза»" : `Раскрыть раздел «Буза»: ${bay.label} — ${bay.note.toLowerCase()}`
            }
            className="river-berth pointer-events-auto absolute grid size-9 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center border-0 bg-transparent p-0"
            style={{ left: `${(bay.point.x / VB_W) * 100}%`, top: `${(bay.point.y / VB_H) * 100}%` }}
          >
            <span className="river-bob block text-[var(--gold)]">
              {bay.version === "buyat" ? <SealDisc size={26} /> : <MugIcon size={19} />}
            </span>
            <span className="river-berth-label record-label">
              {bay.label}
              <span className="block text-[var(--text-4)]">{bay.note}</span>
            </span>
          </button>
        ))}

      {/* Кораблик — the reader's own position on the water, and (on the
          homepage) the "корабль" symbol itself: one boat doing both jobs
          rather than a second one parked in the затон. */}
      <div ref={boatRef} className="absolute top-0 left-0 will-change-transform">
        {bayed ? (
          <button
            type="button"
            onClick={() => enterBay("korabl")}
            aria-expanded={open}
            aria-controls="buza"
            aria-label={open ? "Свернуть раздел «Буза»" : "Раскрыть раздел «Буза»: Затон — лодки ждут очереди"}
            className="river-berth pointer-events-auto grid size-9 cursor-pointer place-items-center border-0 bg-transparent p-0"
          >
            <span className="river-bob block text-[var(--gold)]">
              <BoatIcon size={21} />
            </span>
            <span className="river-berth-label record-label">
              Затон
              <span className="block text-[var(--text-4)]">Лодки ждут очереди</span>
            </span>
          </button>
        ) : (
          <span className="river-bob block text-[var(--gold)] opacity-85">
            <BoatIcon size={21} />
          </span>
        )}
      </div>
    </div>
  );
}
