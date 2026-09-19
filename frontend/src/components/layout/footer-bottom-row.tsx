"use client";

import type { ReactNode } from "react";

import { Container, cn } from "@/components/ui";
import { useScrollToTopVisible } from "@/lib/use-scroll-to-top-visible";

/**
 * The colophon's last row (copyright + "Знаки традиции" seals) — reserves
 * clearance on its right edge for `scroll-to-top.tsx`'s floating button,
 * but only while that button is actually showing.
 *
 * `sm:pr-24`: at `sm` and up this row goes horizontal and the seals would
 * otherwise land flush against the container's own right edge
 * (`justify-between` below) — exactly where the button sits (`right-6`,
 * ~42px wide). `pr-16` (the first value tried here) only cancelled out the
 * button's own footprint almost exactly, leaving the seals touching it with
 * no visible gap; `pr-24` leaves a real ~30px of air. Not needed below
 * `sm`: stacked, the seals sit at their own natural width against the left
 * edge, nowhere near the button.
 *
 * Conditional on `useScrollToTopVisible`, not permanent: scrolling down
 * hides the button, and this row has nothing to clear — the seals belong
 * flush against the edge until scrolling back up actually raises the
 * button into this same corner. `transition-[padding-right]` so the shift
 * reads as the row making room, in step with the button's own fade-in,
 * rather than a snap.
 */
export function FooterBottomRow({ children }: { children: ReactNode }) {
  const buttonVisible = useScrollToTopVisible();

  return (
    <Container
      className={cn(
        "flex flex-col gap-5 border-t border-[var(--border-strong)] py-6 transition-[padding-right] duration-300 ease-out sm:flex-row sm:items-center sm:justify-between",
        buttonVisible && "sm:pr-24",
      )}
    >
      {children}
    </Container>
  );
}
