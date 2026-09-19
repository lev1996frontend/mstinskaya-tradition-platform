"use client";

import { useEffect, useState } from "react";

const SHOW_AFTER_PX = 480;
// A raw "did scrollY go up or down since last event" flips on every single
// pixel of scroll jitter (trackpads and inertial scrolling fire many tiny,
// alternating-sign events even during one steady swipe), which read as the
// button flickering in and out. Only counting a direction change once it
// clears this many pixels since the last committed direction absorbs that
// noise without meaningfully delaying the real thing.
const DIRECTION_HYSTERESIS_PX = 6;

/**
 * True once the page is scrolled far enough down and moving *up* — exactly
 * when `scroll-to-top.tsx` shows its floating button. Shared with
 * `footer-bottom-row.tsx` so the footer's own bottom-right corner can react
 * to that same button (shift the "Знаки традиции" row clear of it only
 * while it's actually on screen) instead of permanently reserving room for
 * it whether or not it's showing.
 *
 * Direction-aware, not just position-aware: past `SHOW_AFTER_PX`, this
 * flips true while scrolling *up* and false while scrolling *down* — see
 * `scroll-to-top.tsx`'s own doc comment for why (the "don't compete with
 * reading" pattern). `DIRECTION_HYSTERESIS_PX` is what keeps that from
 * flickering on scroll-event noise.
 */
export function useScrollToTopVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (y <= SHOW_AFTER_PX) {
        setVisible(false);
      } else if (delta > DIRECTION_HYSTERESIS_PX) {
        setVisible(false); // scrolling down
      } else if (delta < -DIRECTION_HYSTERESIS_PX) {
        setVisible(true); // scrolling up
      }
      // else: inside the hysteresis band — keep whatever it already was.
      lastY = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return visible;
}
