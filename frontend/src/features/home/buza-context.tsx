"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Shared state for the "Буза" section (`buza.tsx`), driven from the river
 * symbols — the header strip's boat/seal/mug (`components/layout/river-strip.tsx`
 * and siblings) and the page-margin river's three bays
 * (`components/layout/river-spine.tsx`). The two live far apart in the tree —
 * the header and the river are mounted once in `app/layout.tsx`, the section
 * only on the homepage — so this is a small top-level provider rather than
 * state lifted into either component.
 */

/** The three readings of the word, one per river symbol. Keys match
 *  `ETYMOLOGY_CHIPS` in `buza.tsx`, which renders them as chips. */
export type BuzaVersion = "buyat" | "korabl" | "drink";

type BuzaContextValue = {
  open: boolean;
  /** Which reading is currently on show, set either by a chip inside the
   *  section or by the river symbol that stands for it. */
  version: BuzaVersion | null;
  toggle: () => void;
  /** Ensures the section is open — never closes it. For a one-shot "reveal"
   *  ritual (the wax seal's crack) that should always land on "open", even if
   *  another symbol already opened the section first; `toggle()` would wrongly
   *  close it in that case. Repeatable open/close controls use `toggle()`. */
  openSection: () => void;
  /**
   * Open the section *on* a given reading — the river bays' own action.
   *
   * Each symbol has always stood for one reading (the seal for "буянить", the
   * boat for "корабль", the mug for "напиток"), but until the bays existed all
   * three did the identical thing: open the section and leave the reader to
   * find the matching chip themselves. Carrying the reading through is what
   * makes three symbols three different controls rather than three skins on
   * one button.
   */
  openWith: (version: BuzaVersion) => void;
  setVersion: (version: BuzaVersion | null) => void;
};

const BuzaContext = createContext<BuzaContextValue | null>(null);

export function BuzaProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState<BuzaVersion | null>(null);

  const toggle = useCallback(() => setOpen((current) => !current), []);
  const openSection = useCallback(() => setOpen(true), []);
  const openWith = useCallback((next: BuzaVersion) => {
    setVersion(next);
    setOpen(true);
  }, []);

  const value = useMemo(
    () => ({ open, version, toggle, openSection, openWith, setVersion }),
    [open, version, toggle, openSection, openWith],
  );

  return <BuzaContext.Provider value={value}>{children}</BuzaContext.Provider>;
}

export function useBuza(): BuzaContextValue {
  const ctx = useContext(BuzaContext);
  if (!ctx) throw new Error("useBuza must be used inside BuzaProvider");
  return ctx;
}
