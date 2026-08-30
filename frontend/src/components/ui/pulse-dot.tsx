"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "./index";

/**
 * Small looping dot used to mark "happening right now" (a live match, a
 * running competition). The animation loops on the dot only — never the
 * whole card — and collapses to a static dot when the user prefers reduced
 * motion.
 */
export function PulseDot({ className, color = "var(--live)" }: { className?: string; color?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <span className={cn("relative inline-flex size-2", className)} aria-hidden="true">
      {!reduceMotion ? (
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ opacity: 0.6, scale: 1 }}
          animate={{ opacity: 0, scale: 2.2 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      ) : null}
      <span className="relative inline-flex size-2 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}
