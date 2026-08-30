"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useMotionValue, useReducedMotion, useSpring } from "framer-motion";

const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

/** Mirrors the `useSyncExternalStore` pattern already used by
 *  `theme-context.tsx` for reading a `matchMedia` capability without a
 *  render-then-effect-then-setState cascade. */
function subscribeFinePointer(onChange: () => void) {
  const query = window.matchMedia(FINE_POINTER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getFinePointerSnapshot(): boolean {
  return window.matchMedia(FINE_POINTER_QUERY).matches;
}

function getFinePointerServerSnapshot(): boolean {
  return false;
}

/**
 * The tradition's actual protective headgear: a padded mask with a wire-mesh
 * grille over the whole face (closer to a HEMA/fencing mask than a
 * motorcycle-visor helmet — see iteration-1 follow-up notes, this replaces
 * an earlier hinged-visor version that didn't match reference photos).
 *
 * Interaction: "wiping condensation off a mirror" — the pointer clears a
 * soft-edged circular patch of the mesh/haze as it moves, via a CSS
 * `mask-image` radial-gradient recentered on every pointermove. This is a
 * continuous tracking effect, not a boolean open/closed toggle, so it can't
 * be meaningfully replicated by focus/tap the way a hinge could:
 * `(hover: hover) and (pointer: fine)` gates whether the reveal wires up at
 * all (mirrors the capability check the now-removed custom cursor used).
 * Touch/keyboard users get a fixed, legible partial-haze rendering instead.
 *
 * The pointermove listener here is scoped to this component's own container
 * (not window-wide) and only calls `motionValue.set(...)`, never a React
 * state setter — this sidesteps the render-thrashing that caused the custom
 * cursor to be removed.
 */
export function HelmetReveal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const maskId = useId();
  const reduceMotion = useReducedMotion();
  const interactive = useSyncExternalStore(
    subscribeFinePointer,
    getFinePointerSnapshot,
    getFinePointerServerSnapshot,
  );
  const [hovering, setHovering] = useState(false);

  // Off-canvas resting position so the clear patch starts fully hidden.
  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const springConfig = { stiffness: 220, damping: 26, mass: 0.5 };
  const springX = useSpring(mx, springConfig);
  const springY = useSpring(my, springConfig);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !interactive) return;

    const unsubX = springX.on("change", (value) => {
      el.style.setProperty("--mx", `${value}px`);
    });
    const unsubY = springY.on("change", (value) => {
      el.style.setProperty("--my", `${value}px`);
    });
    return () => {
      unsubX();
      unsubY();
    };
  }, [interactive, springX, springY]);

  const wireUpReveal = interactive && !reduceMotion;

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!wireUpReveal) return;
    const rect = event.currentTarget.getBoundingClientRect();
    mx.set(event.clientX - rect.left);
    my.set(event.clientY - rect.top);
    setHovering(true);
  }

  function handlePointerLeave() {
    if (!wireUpReveal) return;
    mx.set(-100);
    my.set(-100);
    setHovering(false);
  }

  // Reduced-motion or coarse-pointer users: no tracking at all, just a fixed
  // legible face with a faint static mesh texture on top (simpler and more
  // honest than snapping a "reveal" to a pointer that isn't really moving).
  const staticFallback = !wireUpReveal;

  return (
    <div
      ref={containerRef}
      className="relative mx-auto hidden aspect-[3/4] w-56 shrink-0 select-none lg:block"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={
        {
          "--mx": "-100px",
          "--my": "-100px",
        } as CSSProperties
      }
    >
      {/* face — static, sits beneath the mesh at all times */}
      <svg
        viewBox="0 0 100 130"
        className="absolute inset-0 h-full w-full text-[var(--muted)]"
        aria-hidden="true"
      >
        <path
          d="M50 34 C34 34 26 48 26 66 C26 92 37 110 50 114 C63 110 74 92 74 66 C74 48 66 34 50 34 Z"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="none"
          opacity="0.8"
        />
        <path d="M38 62 L44 62 M56 62 L62 62" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M45 82 Q50 86 55 82" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </svg>

      {/* padded shell outline — always fully visible, doesn't hide the face,
          just frames it (dome top + jaw padding from the reference photos) */}
      <svg
        viewBox="0 0 100 130"
        className="pointer-events-none absolute inset-0 h-full w-full text-[var(--accent)]"
        aria-hidden="true"
      >
        <path
          d="M50 6 C26 6 15 26 15 50 L15 88 C15 106 30 120 50 120 C70 120 85 106 85 88 L85 50 C85 26 74 6 50 6 Z"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          opacity="0.9"
        />
        <path
          d="M30 104 C36 112 43 116 50 116 C57 116 64 112 70 104"
          stroke="currentColor"
          strokeWidth="1.6"
          fill="none"
          opacity="0.55"
        />
      </svg>

      {/* mesh grille + haze — covers the face oval; a mask-image radial
          gradient cuts a soft "wiped" patch centered on the pointer,
          revealing the face beneath more clearly right there */}
      <svg
        viewBox="0 0 100 130"
        className="pointer-events-none absolute inset-0 h-full w-full text-[var(--accent)]"
        aria-hidden="true"
        style={
          staticFallback
            ? { opacity: 0.7 }
            : {
                maskImage: `radial-gradient(circle 60px at var(--mx) var(--my), transparent 0%, transparent 55%, black 100%)`,
                WebkitMaskImage: `radial-gradient(circle 60px at var(--mx) var(--my), transparent 0%, transparent 55%, black 100%)`,
                opacity: hovering ? 1 : 0.92,
                transition: "opacity 0.2s ease",
              }
        }
      >
        <defs>
          <pattern id={maskId} width="4.2" height="4.2" patternUnits="userSpaceOnUse">
            <path d="M0 4.2 L4.2 0" stroke="currentColor" strokeWidth="0.5" />
            <path d="M0 0 L4.2 4.2" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
          <clipPath id={`${maskId}-clip`}>
            <path d="M50 34 C34 34 26 48 26 66 C26 92 37 110 50 114 C63 110 74 92 74 66 C74 48 66 34 50 34 Z" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${maskId}-clip)`}>
          {/* haze backing so the face reads as dim/obscured, not fully hidden */}
          <rect x="20" y="30" width="60" height="90" fill="var(--surface)" opacity="0.6" />
          {/* fine wire mesh weave */}
          <rect x="20" y="30" width="60" height="90" fill={`url(#${maskId})`} opacity="0.75" />
        </g>
      </svg>
    </div>
  );
}
