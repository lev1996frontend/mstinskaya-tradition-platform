"use client";

import { useId } from "react";

import { cn } from "@/components/ui";

/**
 * Low-opacity geometric interlace/lattice tile — the one repeating background
 * motif, used only in hero sections, never as loud wallpaper. `useId` keeps
 * the `<pattern>` id collision-free when the motif appears more than once per
 * page.
 *
 * The weave is masked into a diagonal falloff (strong at the top-right,
 * absent at the bottom-left) rather than tiled flat across the whole panel:
 * an even field reads as wallpaper, a falloff reads as a woven ground the
 * headline is set on — and it keeps the texture off the running text.
 */
export function InterlacePattern({ className }: { className?: string }) {
  const patternId = `interlace-lattice-${useId()}`;
  const fade = "linear-gradient(to bottom left, black 0%, rgba(0,0,0,0.35) 45%, transparent 78%)";

  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]", className)}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
      style={{ maskImage: fade, WebkitMaskImage: fade }}
    >
      <defs>
        <pattern id={patternId} width="44" height="44" patternUnits="userSpaceOnUse">
          <path d="M0 22 L22 0 L44 22 L22 44 Z" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M0 0 L44 44 M44 0 L0 44" stroke="currentColor" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
