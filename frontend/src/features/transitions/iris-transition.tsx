"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";

/**
 * Circular "iris" page transition, mounted once near the root layout.
 *
 * This is deliberately NOT a shared-element morph: the tournament list and a
 * tournament/competition detail route are separate server-rendered trees, so
 * there is no shared React fiber for Framer Motion to interpolate between a
 * clicked card and the destination screen. Reworking the rendering model to
 * fake that would contradict the server-component fetch pattern the rest of
 * the app relies on.
 *
 * Instead: a full-viewport circle grows from the click point (in
 * `--background`) until it covers the screen, the route navigates once
 * covered, then the circle shrinks away over the freshly-mounted
 * destination. It delivers "never a hard cut to a blank page" — not literal
 * DOM continuity — and that distinction is the honest scope of this effect.
 */

type IrisContextValue = {
  trigger: (x: number, y: number, href: string) => void;
};

const IrisContext = createContext<IrisContextValue | null>(null);

const COVER_DURATION = 0.42;
const HOLD_MS = 90;

export function IrisTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<{ x: number; y: number; phase: "cover" | "reveal" } | null>(
    null,
  );
  const pendingHref = useRef<string | null>(null);

  function trigger(x: number, y: number, href: string) {
    if (reduceMotion) {
      router.push(href);
      return;
    }
    pendingHref.current = href;
    setState({ x, y, phase: "cover" });
  }

  function handleComplete() {
    if (!state) return;
    if (state.phase === "cover") {
      if (pendingHref.current) {
        router.push(pendingHref.current);
        pendingHref.current = null;
      }
      // A short hold gives the newly-pushed route a moment to paint before
      // the mask starts shrinking away, so "reveal" uncovers real content
      // rather than the tail end of the previous page.
      window.setTimeout(() => {
        setState((current) => (current ? { ...current, phase: "reveal" } : current));
      }, HOLD_MS);
    } else {
      setState(null);
    }
  }

  return (
    <IrisContext.Provider value={{ trigger }}>
      {children}
      <AnimatePresence>
        {state ? (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[80] bg-[var(--background)]"
            initial={{ clipPath: `circle(0% at ${state.x}px ${state.y}px)` }}
            animate={{
              clipPath:
                state.phase === "cover"
                  ? `circle(150% at ${state.x}px ${state.y}px)`
                  : `circle(0% at ${state.x}px ${state.y}px)`,
            }}
            transition={{ duration: COVER_DURATION, ease: [0.16, 1, 0.3, 1] }}
            onAnimationComplete={handleComplete}
          />
        ) : null}
      </AnimatePresence>
    </IrisContext.Provider>
  );
}

/** Returns a `(x, y, href)` trigger — call it from a click handler with the
 *  pointer position and the destination href instead of navigating directly. */
export function useIrisTransition(): (x: number, y: number, href: string) => void {
  const ctx = useContext(IrisContext);
  if (!ctx) throw new Error("useIrisTransition must be used within an IrisTransitionProvider");
  return ctx.trigger;
}
