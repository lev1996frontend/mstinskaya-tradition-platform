"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/components/ui";

import { MonogramFlip } from "./monogram-flip";
import { randomWeaponMotif, type WeaponMotifKey } from "./weapon-glyphs";

/** How long the tap-triggered weapon reveal holds before flipping back on
 *  its own — a touch device never fires `mouseleave` to end it the way a
 *  desktop hover does, so this timer stands in for that. */
const LOGO_TAP_REVEAL_MS = 1400;

/**
 * The site's own mark: the monogram badge, the flip-to-a-weapon hover, the
 * click-triggered сшибка duel, and the link home — extracted from
 * `SiteHeader`, which used to be the only place this lived, so every other
 * appearance of the logo (the footer, the mobile menu panel) can carry the
 * *same* mark rather than a static lookalike. A static copy is a different
 * logo that happens to look right at rest — the whole point of a mark is
 * that it's the one thing on the page guaranteed to behave the same way
 * everywhere it appears.
 */
export function SiteLogo({
  size = 20,
  className,
  onNavigate,
  variant = "flip",
}: {
  size?: number;
  className?: string;
  /** Called (in addition to the logo's own click handling) when the logo is
   *  actually going to navigate — e.g. the mobile menu panel closes itself
   *  on the same click that sends you home. Not called when the click is
   *  swallowed for already being on "/". */
  onNavigate?: () => void;
  /** Forwarded to `MonogramFlip` — see its own doc comment. The header uses
   *  the default "flip"; other appearances of this same mark can use
   *  "slide" to read as the same mark without looking like a literal copy
   *  of the header's own motion. */
  variant?: "flip" | "slide";
}) {
  const pathname = usePathname();
  const [logoActive, setLogoActive] = useState(false);
  const [logoStruck, setLogoStruck] = useState(false);
  const [logoOpponent, setLogoOpponent] = useState<WeaponMotifKey>("kisten");
  const logoRevealTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A tap has no `mouseenter`/`mouseleave` of its own, so `logoActive` (which
  // only ever toggled from those on desktop) never turned true on a phone —
  // the flip had nothing to play. This drives the same state directly from
  // the click, then reverts it on a timer, one flip out and one flip back,
  // never a repeating spin: clearing any pending timer first means mashing
  // the logo restarts the hold instead of stacking reverts.
  function revealLogoBriefly() {
    setLogoActive(true);
    if (logoRevealTimeout.current) clearTimeout(logoRevealTimeout.current);
    logoRevealTimeout.current = setTimeout(() => setLogoActive(false), LOGO_TAP_REVEAL_MS);
  }
  useEffect(() => {
    return () => {
      if (logoRevealTimeout.current) clearTimeout(logoRevealTimeout.current);
    };
  }, []);

  return (
    <Link
      href="/"
      className={cn("flex shrink-0 items-center gap-2.5", className)}
      onMouseEnter={() => setLogoActive(true)}
      onMouseLeave={() => setLogoActive(false)}
      onFocus={() => setLogoActive(true)}
      onBlur={() => setLogoActive(false)}
      onClick={(event) => {
        // Already home: there is nowhere new to go, so skip the navigation
        // outright rather than let `Link` re-fetch/re-render the same
        // route — the thing that could look like a reload.
        if (pathname === "/") {
          event.preventDefault();
        } else {
          onNavigate?.();
        }
        setLogoOpponent(randomWeaponMotif());
        setLogoStruck(true);
        revealLogoBriefly();
      }}
    >
      <MonogramFlip
        flipped={logoActive}
        struck={logoStruck}
        opponent={logoOpponent}
        onStrikeEnd={() => setLogoStruck(false)}
        size={size}
        variant={variant}
      />
      {/* The wordmark states the three type roles in miniature: display
          serif name over a stamped record caption. */}
      <span className="leading-tight">
        <span className="font-display block text-[0.9375rem] font-semibold tracking-tight">
          Мстинская
        </span>
        <span className="font-record block text-[0.6rem] uppercase tracking-[0.22em] text-[var(--muted)]">
          традиция
        </span>
      </span>
    </Link>
  );
}
