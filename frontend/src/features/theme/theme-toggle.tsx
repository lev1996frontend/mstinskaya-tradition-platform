"use client";

import { Moon, Sun } from "lucide-react";

import { cn } from "@/components/ui";

import { useTheme } from "./theme-context";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
      title={isDark ? "Светлая тема" : "Тёмная тема"}
      className={cn(
        // square-cut like every other control in the system; the round pill
        // was the last rounded chrome element left in the header
        "inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--iron-line)] text-[var(--iron-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]",
        className,
      )}
    >
      {isDark ? <Sun className="size-4" strokeWidth={1.75} /> : <Moon className="size-4" strokeWidth={1.75} />}
    </button>
  );
}
