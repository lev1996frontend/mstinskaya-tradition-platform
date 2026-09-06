"use client";

import { useScrollToTop } from "@/lib/use-scroll-to-top";

/**
 * «Наверх» in the colophon — the footer's own way back up, and the reason the
 * floating button can stand down once the footer is on screen (see
 * `scroll-to-top.tsx`).
 *
 * Written out rather than drawn: an arrow alone is the one thing a back-to-top
 * control is regularly faulted for, and down here there is room for the word.
 * The arrow stays, and leads — it lifts on hover the way `.label-link-fwd`'s
 * arrow slides right, the same gesture turned through ninety degrees, while the
 * label holds still.
 *
 * `.label-link` carries the rest of the hover for it: the step toward the
 * reader, the lift to `--foreground`, and the groove opening underneath. This
 * is a stamped label that leads somewhere, which is exactly what that class is
 * for, and it means this control cannot drift out of the language every other
 * arrow link on the site speaks.
 */
export function FooterToTop() {
  const scrollToTop = useScrollToTop();

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className="record-label label-link group shrink-0 text-[var(--muted)]"
    >
      Наверх
      <svg
        width={11}
        height={11}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="ml-1.5 inline-block align-[-1px] transition-transform duration-200 ease-[var(--ease-out)] group-hover:-translate-y-0.5"
      >
        <path
          d="M12 19 V6 M6 11.5 L12 5.5 L18 11.5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
