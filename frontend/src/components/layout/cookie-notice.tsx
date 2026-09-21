"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui";
import { routes } from "@/lib/routes";

import { useCookieNotice } from "./cookie-notice-context";

/**
 * Shown once, on a visitor's first visit — dismissed state persists in
 * `localStorage` (see `cookie-notice-context.tsx`) so it never comes back on
 * this device. Pure disclosure, not a consent gate: the platform only sets
 * strictly-necessary session cookies (login), which don't legally require
 * opt-in, so there is nothing here to block on and no "reject" action — just
 * the one acknowledgement button.
 */
export function CookieNotice() {
  const { visible, dismiss, setHeight } = useCookieNotice();
  const reduceMotion = useReducedMotion();
  const barRef = useRef<HTMLDivElement>(null);

  // Reports its own height to the shared context so `scroll-to-top.tsx` can
  // clear it — measured, not guessed, since the bar wraps to two lines under
  // ~420px wide.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || !visible) {
      setHeight(0);
      return;
    }
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    observer.observe(bar);
    return () => observer.disconnect();
  }, [visible, setHeight]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          ref={barRef}
          role="status"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
          // Full-width bar, not a card: a single hairline top border (the
          // site's ordinary rule colour, not the accent) and the same flat
          // surface every other bit of chrome sits on — no shadow, no
          // rounded box. `min-h-16` (64px) is the spec's lower bound; it
          // only grows past that when the row actually wraps on a narrow
          // viewport, never on its own.
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-strong)] bg-[var(--surface)]"
        >
          {/* `w-fit`, not `flex-1` on the paragraph inside a wide container:
              that stretched the text to fill the whole bar and pushed the
              button off to the far edge on a wide screen — text and button
              read as two unrelated things sharing a shelf instead of one
              group. Centered as that tight group instead. */}
          <div className="mx-auto flex min-h-16 max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-6">
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              Мы используем только технически необходимые cookie — для входа в личный кабинет,
              без аналитики и рекламы.{" "}
              {/* Muted grey-beige at rest, no underline until hover — a
                  footnote beside the paragraph it belongs to, not a second
                  call to action competing with «Понятно». */}
              <Link
                href={routes.cookies()}
                className="text-[var(--muted)] underline-offset-2 transition-colors hover:text-[var(--foreground)] hover:underline"
              >
                Подробнее
              </Link>
              .
            </p>
            <Button
              type="button"
              onClick={dismiss}
              // Default size ("md"), not "sm": `size="sm"` sets `text-xs`
              // (12px) against this paragraph's `text-sm` (14px), which read
              // as the button having shrunk relative to the sentence beside
              // it rather than just being compact. `borderRadius` is still a
              // local override — the site's buttons are square-cut
              // (`--radius-sm`, 2px) everywhere else; this one reads more
              // rounded/contemporary on request.
              style={{ borderRadius: "7px" }}
              className="shrink-0"
            >
              Понятно
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
