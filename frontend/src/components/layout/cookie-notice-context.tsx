"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Shared with two consumers: `cookie-notice.tsx` (which renders the bar) and
 * `scroll-to-top.tsx` (which has to get out from under it) — both are
 * mounted at the root layout but need the same "is the bar up, and how tall
 * is it" answer, the same reason `buza-context.tsx` exists for the homepage
 * river bays. A plain prop can't cross that gap; this can.
 */

const STORAGE_KEY = "cookie-notice-dismissed";

type CookieNoticeContextValue = {
  visible: boolean;
  /** Real measured height of the bar, not a guessed constant — it wraps to
   *  two lines under ~420px, and `scroll-to-top.tsx`'s offset has to clear
   *  whatever it actually rendered at, the same reasoning `river-spine.tsx`'s
   *  `contentInset` and `footer-bottom-row.tsx`'s clearance already use
   *  elsewhere on this site rather than a breakpoint-tuned number. */
  height: number;
  setHeight: (height: number) => void;
  dismiss: () => void;
};

const CookieNoticeContext = createContext<CookieNoticeContextValue | null>(null);

export function CookieNoticeProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const checkDismissed = () => {
      try {
        if (localStorage.getItem(STORAGE_KEY) !== "1") setVisible(true);
      } catch {
        // Private browsing / blocked storage: show it, but dismissing this
        // time won't stick — there's nowhere to remember that.
        setVisible(true);
      }
    };
    checkDismissed();
  }, []);

  // Pushes the whole document up by the bar's own height while it's visible
  // — the bar is `fixed`, so without this it sits over whatever content is
  // scrolled to the true bottom of the page, footer included, rather than
  // making room for itself. `body`'s `transition: padding-bottom` (see
  // globals.css) is what makes this land as a slide, not a jump.
  useEffect(() => {
    document.body.style.paddingBottom = visible && height > 0 ? `${height}px` : "";
  }, [visible, height]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* Nothing to persist to — the notice will just show again next visit. */
    }
  }, []);

  const value = useMemo<CookieNoticeContextValue>(
    () => ({ visible, height, setHeight, dismiss }),
    [visible, height, dismiss],
  );

  return <CookieNoticeContext.Provider value={value}>{children}</CookieNoticeContext.Provider>;
}

export function useCookieNotice(): CookieNoticeContextValue {
  const context = useContext(CookieNoticeContext);
  if (!context) throw new Error("useCookieNotice must be used inside <CookieNoticeProvider>");
  return context;
}
