"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

/**
 * Manual light/dark toggle. Additive to the `prefers-color-scheme` handling
 * already in `globals.css` — "system" means "no `data-theme` attribute,
 * follow the OS", so the page still degrades correctly with JS disabled.
 *
 * Built on `useSyncExternalStore` (localStorage + the OS media query are the
 * external store) rather than effect-driven `setState`, so there is no
 * post-mount re-render cascade — the DOM attribute is applied synchronously
 * from the event handler that changes it, and the inline `ThemeScript` in
 * `<head>` already applies the stored choice before first paint.
 */

export type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "mstina-theme";
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const onMediaChange = () => emitChange();
  mql.addEventListener("change", onMediaChange);
  window.addEventListener("storage", emitChange);
  return () => {
    listeners.delete(listener);
    mql.removeEventListener("change", onMediaChange);
    window.removeEventListener("storage", emitChange);
  };
}

function getThemeSnapshot(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function getThemeServerSnapshot(): ThemePreference {
  return "system";
}

function getSystemIsDarkSnapshot(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getSystemIsDarkServerSnapshot(): boolean {
  return false;
}

function applyDomTheme(theme: ThemePreference) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

function persistTheme(theme: ThemePreference) {
  try {
    if (theme === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
  } catch {
    // localStorage unavailable (private mode, etc.) — theme just won't persist.
  }
}

function setGlobalTheme(theme: ThemePreference) {
  persistTheme(theme);
  applyDomTheme(theme);
  emitChange();
}

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, getThemeServerSnapshot);
  const systemIsDark = useSyncExternalStore(
    subscribe,
    getSystemIsDarkSnapshot,
    getSystemIsDarkServerSnapshot,
  );
  const resolvedTheme: ResolvedTheme = theme === "system" ? (systemIsDark ? "dark" : "light") : theme;

  function setTheme(next: ThemePreference) {
    setGlobalTheme(next);
  }

  function toggleTheme() {
    setGlobalTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
