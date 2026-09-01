"use client";

import { useId } from "react";

/**
 * The protective mask's illustration, factored out of `helmet-reveal.tsx`
 * as a static presentational glyph: same halo + double red ring + gold mesh
 * (with its horizontal grille-wire divider lines) + gorget, minus the
 * interactive pointer-wipe reveal — for contexts that want the mask's
 * *look* (an "awaiting a fighter/жребий" placeholder, say) without
 * `helmet-reveal.tsx`'s own hover mechanic, client-only pointer tracking,
 * or its self-contained plate frame (ticks + caption bar), which callers
 * here already provide themselves.
 *
 * The gorget is unioned into the SAME mesh clip as the face oval (not a
 * separately-filled capsule with its own lines) — reference photos of the
 * real mask+gorget show one continuous wire mesh running from the face
 * down over the neck, not a mask stopping cleanly above a distinct padded
 * piece.
 */
const FACE_OVAL_PATH = "M50 34 C34 34 26 48 26 66 C26 92 37 110 50 114 C63 110 74 92 74 66 C74 48 66 34 50 34 Z";
const GORGET_PATH =
  "M38 104 C38 99 43 96 50 96 C57 96 62 99 62 104 L62 120 C62 126 56 129 50 129 C44 129 38 126 38 120 Z";

export function MaskGlyph({ size = 130, className }: { size?: number; className?: string }) {
  // Two fighter cards can both be in the "no weapon declared yet" state at
  // once (before either side has drawn), rendering two `MaskGlyph`s on the
  // same page — fixed SVG ids would collide and only one mesh would resolve.
  const uid = useId();
  return (
    <div className={className} style={{ position: "relative", width: size, height: size * 1.3 }} aria-hidden="true">
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "135%",
          aspectRatio: "1 / 1",
          transform: "translate(-50%, -50%)",
          borderRadius: "9999px",
          border: "1px solid var(--border)",
          opacity: 0.5,
        }}
      />

      <svg viewBox="0 0 100 130" className="absolute inset-0 h-full w-full text-[var(--accent)]">
        <path
          d="M50 6 C26 6 15 26 15 50 L15 88 C15 106 30 120 50 120 C70 120 85 106 85 88 L85 50 C85 26 74 6 50 6 Z"
          stroke="currentColor"
          strokeWidth="2.4"
          fill="none"
          opacity="0.95"
        />
        <path d={FACE_OVAL_PATH} stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.6" />
        <path d={GORGET_PATH} stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.6" />
      </svg>

      <svg viewBox="0 0 100 130" className="pointer-events-none absolute inset-0 h-full w-full text-[var(--gold)]" style={{ opacity: 0.92 }}>
        <defs>
          <pattern id={`${uid}-weave`} width="4.2" height="4.2" patternUnits="userSpaceOnUse">
            <path d="M0 4.2 L4.2 0" stroke="currentColor" strokeWidth="0.5" />
            <path d="M0 0 L4.2 4.2" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
          <clipPath id={`${uid}-clip`}>
            <path d={FACE_OVAL_PATH} />
            <path d={GORGET_PATH} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${uid}-clip)`}>
          <rect x="20" y="30" width="60" height="99" fill="var(--surface)" opacity="0.6" />
          <rect x="20" y="30" width="60" height="99" fill={`url(#${uid}-weave)`} opacity="0.75" />
          <path d="M22 56 H78 M22 74 H78 M22 92 H78 M22 110 H78" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        </g>
      </svg>
    </div>
  );
}
