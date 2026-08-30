"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { Monogram } from "@/components/brand/monogram";
import { WEAPON_MOTIFS } from "@/components/brand/weapon-glyphs";

/**
 * The header plate turns over on hover/focus (driven by the enclosing link in
 * `SiteHeader`, so keyboard users get it too) and lands on the next weapon
 * glyph in sequence — a different one each time, cycling in a fixed order so
 * it stays predictable rather than showing a single fixed reverse face.
 *
 * A single 180° turn per toggle (not an extra full spin): a bigger throw-style
 * rotation crosses the edge-on boundary three times instead of once at this
 * icon size, which read as flicker/jitter rather than a flourish.
 */
export function MonogramFlip({ flipped, size = 20 }: { flipped: boolean; size?: number }) {
  const reduceMotion = useReducedMotion();
  const [rotation, setRotation] = useState(0);
  const [weaponIndex, setWeaponIndex] = useState(0);
  const prevFlipped = useRef(flipped);

  useEffect(() => {
    if (flipped === prevFlipped.current) return;
    prevFlipped.current = flipped;
    if (flipped) {
      setWeaponIndex((current) => (current + 1) % WEAPON_MOTIFS.length);
    }
    setRotation((r) => r + 180);
  }, [flipped]);

  const { Icon } = WEAPON_MOTIFS[weaponIndex];

  return (
    <span className="relative grid size-9 shrink-0 place-items-center" style={{ perspective: 400 }}>
      <motion.span
        className="grid size-9 place-items-center rounded-[var(--radius-sm)] bg-[var(--accent)] text-white"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateX: rotation }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="grid place-items-center" style={{ backfaceVisibility: "hidden" }}>
          <Monogram size={size} />
        </span>
        <span
          className="absolute inset-0 grid place-items-center"
          style={{ backfaceVisibility: "hidden", transform: "rotateX(180deg)" }}
        >
          <Icon size={size} />
        </span>
      </motion.span>
    </span>
  );
}
