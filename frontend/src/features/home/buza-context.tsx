"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/**
 * Shared open/closed state for the "Буза" section (`buza.tsx`), toggled from
 * the river symbols in the header (`components/layout/river-strip.tsx` and
 * its `river-wax-seal.tsx`/`river-goblet.tsx` siblings — boat, wax seal,
 * goblet). The two live far apart in the tree — the header is mounted once
 * in `app/layout.tsx`, the section only on the homepage — so this is a small
 * top-level provider (wrapped around the whole app in `layout.tsx`, same
 * spot as `AuthProvider`) rather than state lifted into either component.
 */
type BuzaContextValue = {
  open: boolean;
  toggle: () => void;
  /** Ensures the section is open — never closes it. For a one-shot "reveal"
   *  ritual (the wax seal's crack) that should always land on "open", even
   *  if another symbol already opened the section first; `toggle()` would
   *  wrongly close it in that case. Repeatable open/close controls (the
   *  boat, the goblet) use `toggle()` instead. */
  openSection: () => void;
};

const BuzaContext = createContext<BuzaContextValue | null>(null);

export function BuzaProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((current) => !current), []);
  const openSection = useCallback(() => setOpen(true), []);
  return (
    <BuzaContext.Provider value={{ open, toggle, openSection }}>{children}</BuzaContext.Provider>
  );
}

export function useBuza(): BuzaContextValue {
  const ctx = useContext(BuzaContext);
  if (!ctx) throw new Error("useBuza must be used inside BuzaProvider");
  return ctx;
}
