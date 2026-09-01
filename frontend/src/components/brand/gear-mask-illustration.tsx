"use client";

import { useId } from "react";

// Redrawn 2026-09-01, fourth pass — the third pass still read as a
// symmetric metal dome with a circular cage (a fantasy/medieval helmet), not
// the tradition's actual gear. Rebuilt shape-first this time, against
// `mstinskaya-gear-references/mask-reference-front.png` (the primary
// reference) plus -side/-crowd: a soft, slightly irregular black hood (flat
// -ish top, bulging sides at ear level, NOT a smooth round dome) with a
// framed rectangular mesh grille inset into its face opening (visibly
// FRAMED by black material on all sides, not touching the helmet's own
// outline — an elongated rounded rectangle, never a circle), and a wide,
// soft, rectangular fabric gorget sitting flush under it. Decoration
// (mesh weave, the thin red trim, the gold frame line) is deliberately
// minimal and added last — the black silhouette is what has to read as
// "real protective gear" on its own, before any of that.
const HELMET_PATH =
  "M32 4 L68 4 Q86 6 88 24 L88 44 Q90 55 85 63 L81 75 Q77 86 62 88 L38 88 Q23 86 19 75 L15 63 Q10 55 12 44 L12 24 Q14 6 32 4 Z";
const FACE_GRID_OUTER_PATH =
  "M31 27 C28 27 26 29 26 33 L26 73 C26 78 30 80 34 80 L66 80 C70 80 74 78 74 73 L74 33 C74 29 72 27 69 27 Z";
const FACE_GRID_INNER_PATH =
  "M33 30 C31 30 29 31 29 34 L29 71 C29 75 32 77 35 77 L65 77 C68 77 71 75 71 71 L71 34 C71 31 69 30 67 30 Z";
const GORGET_PATH =
  "M19 83 C19 79 29 77 40 77 L60 77 C71 77 81 79 81 83 L83 108 C83 122 68 128 50 128 C32 128 17 122 17 108 Z";

/**
 * The exhibit's three parts as named groups (`#helmet`, `#face-grid`,
 * `#neck-guard`, `#details`) so any of them can be targeted independently
 * later without re-splitting the markup.
 *
 * Layering, deliberately in this order — shape before decoration:
 * 1. Solid black-ish silhouettes for all three parts (this is what has to
 *    read correctly against the reference photos at a glance).
 * 2. The mesh weave, clipped to the grille's own inset frame.
 * 3. A thin — not bold — red trim, and a thin gold retrace of the grille's
 *    frame. Neither is meant to be the thing a viewer notices first.
 *
 * Interaction is unchanged from the previous pass: the pointer wipe acts on
 * the mesh only; tilt is applied by the caller (`helmet-reveal.tsx`) to the
 * whole illustration.
 */
export function GearMaskIllustration({ hovering, staticFallback }: { hovering: boolean; staticFallback: boolean }) {
  const uid = useId();

  return (
    <svg viewBox="0 0 100 130" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-fabric`} x1="20%" y1="0%" x2="75%" y2="100%">
          <stop offset="0%" stopColor="var(--iron)" />
          <stop offset="40%" stopColor="var(--surface)" />
          <stop offset="100%" stopColor="var(--background-deep)" />
        </linearGradient>
        <pattern id={`${uid}-weave`} width="2.6" height="2.6" patternUnits="userSpaceOnUse">
          <path d="M0 2.6 L2.6 0" stroke="var(--gold)" strokeWidth="0.4" />
          <path d="M0 0 L2.6 2.6" stroke="var(--gold)" strokeWidth="0.4" />
        </pattern>
        <clipPath id={`${uid}-grid-clip`}>
          <path d={FACE_GRID_INNER_PATH} />
        </clipPath>
      </defs>

      {/* ================= helmet: soft padded hood — flatter top, bulging
          sides at ear level, narrowing at the jaw. Fabric, not metal: a
          near-black gradient fill, only a hairline of red at the rim. ===== */}
      <g id="helmet">
        <path d={HELMET_PATH} fill={`url(#${uid}-fabric)`} stroke="var(--accent)" strokeWidth="0.5" opacity="0.3" />
        {/* the seam where the flat top pad meets the sides — visible in
            every reference photo */}
        <path d="M17 22 C30 17 70 17 83 22" stroke="var(--muted)" strokeWidth="1" fill="none" opacity="0.35" strokeLinecap="round" />
        {/* soft highlight, upper-left — reads as padded fabric catching
            light, not a flat cutout; kept faint on purpose */}
        <path d="M24 16 C30 10 40 7 50 6" stroke="var(--surface-paper)" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.1" />
      </g>

      {/* ================= details: the strap/rivets mounting the grille to
          the helmet's face opening ================= */}
      <g id="details">
        <path d="M25 28 L23 33 M75 28 L77 33" stroke="var(--surface-paper-ink)" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
        {[
          [24, 30],
          [76, 30],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.1" fill="var(--muted)" opacity="0.7" />
        ))}
      </g>

      {/* ================= face-grid: the mesh grille — a framed, elongated
          rounded RECTANGLE inset into the helmet's face opening (visible
          black margin on every side), never a circle ================= */}
      <g id="face-grid">
        <path d={FACE_GRID_OUTER_PATH} fill="var(--surface-muted)" stroke="var(--gold)" strokeWidth="1.1" opacity="0.95" />

        <g
          style={
            staticFallback
              ? { opacity: 0.8 }
              : {
                  maskImage: `radial-gradient(circle 40px at var(--mx) var(--my), transparent 0%, transparent 55%, black 100%)`,
                  WebkitMaskImage: `radial-gradient(circle 40px at var(--mx) var(--my), transparent 0%, transparent 55%, black 100%)`,
                  opacity: hovering ? 1 : 0.94,
                  filter: hovering ? "brightness(1.12)" : "none",
                  transition: "opacity 0.2s ease, filter 0.2s ease",
                }
          }
        >
          <g clipPath={`url(#${uid}-grid-clip)`}>
            <rect x="29" y="30" width="42" height="47" fill="var(--background-deep)" opacity="0.55" />
            <rect x="29" y="30" width="42" height="47" fill={`url(#${uid}-weave)`} opacity="0.9" />
            {/* eye shadows — where a face sits behind the mesh */}
            <path d="M40 50 L46 50 M54 50 L60 50" stroke="var(--background-deep)" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
          </g>
        </g>

        <path d={FACE_GRID_INNER_PATH} fill="none" stroke="var(--gold)" strokeWidth="0.7" opacity="0.5" />
      </g>

      {/* ================= neck-guard: the gorget — wide, soft, rectangular,
          flush against the helmet's own bottom edge (no visible gap) ===== */}
      <g id="neck-guard">
        <path d={GORGET_PATH} fill={`url(#${uid}-fabric)`} stroke="var(--accent)" strokeWidth="0.5" opacity="0.3" />
        <path d="M27 88 C36 84 44 82 50 82" stroke="var(--surface-paper)" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.08" />
        <g stroke="var(--muted)" strokeWidth="1" fill="none" opacity="0.3" strokeLinecap="round">
          <path d="M25 98 C36 101 64 101 75 98" />
          <path d="M23 110 C36 114 64 114 77 110" />
        </g>
      </g>
    </svg>
  );
}
