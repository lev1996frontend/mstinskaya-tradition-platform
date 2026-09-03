"use client";

import { useSyncExternalStore } from "react";

const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

/** Mirrors the `useSyncExternalStore` pattern already used by
 *  `theme-context.tsx` for reading a `matchMedia` capability without a
 *  render-then-effect-then-setState cascade. */
function subscribe(onChange: () => void) {
  const query = window.matchMedia(FINE_POINTER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(FINE_POINTER_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/** True on desktop-class pointers (mouse/trackpad with hover) — gates
 *  pointer-driven effects (custom cursor, tilt/wipe reveals) that would be
 *  wrong or unusable on a touch screen. */
export function useFinePointer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
