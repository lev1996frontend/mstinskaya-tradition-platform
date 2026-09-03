"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useMotionValue, useReducedMotion, useSpring } from "framer-motion";

import { GearMaskIllustration } from "@/components/brand/gear-mask-illustration";
import { EQUIPMENT_ITEMS } from "@/features/home/equipment-items";
import { useFinePointer } from "@/lib/use-fine-pointer";

const MASK_ITEM = EQUIPMENT_ITEMS.find((item) => item.title === "Маска")!;
const GORGET_ITEM = EQUIPMENT_ITEMS.find((item) => item.title === "Горжет")!;

/**
 * The tradition's actual protective headgear — redrawn 2026-09-01 (third
 * pass, against real reference photos: `mstinskaya-gear-references/mask-
 * reference-{front,side,crowd}.png`) as ONE continuous silhouette — helmet,
 * face mesh, and neck gorget — rather than two spatially separated blocks.
 * The references show the gorget sitting almost flush against the mesh's own
 * lower edge, not a couple of centimetres below it, so `GearMaskIllustration`
 * now draws all three as named groups (`#helmet`/`#face-grid`/`#neck-guard`/
 * `#details`) inside one shared viewBox — still visually distinct through
 * fill/texture (fabric vs. wire mesh vs. fabric collar), not through spatial
 * gap. Each still gets its own callout label above/below the single
 * illustration so a viewer can name the pieces at a glance.
 *
 * Self-contained "specimen plate" (border, four `.tick` corners, its own
 * bottom caption bar) — the same archival-illustration framing as
 * `clash-card.tsx`/`hero-clash.tsx`'s `EquipmentPlate`.
 *
 * Interaction, three small pieces:
 * - "Wiping condensation off a mirror" on the face-grid mesh only — the
 *   pointer clears a soft-edged circular patch via a CSS `mask-image`
 *   radial-gradient recentred on every pointermove.
 * - A capped ±1.5deg rotateX/rotateY tilt on the whole illustration, driven
 *   by the same pointer position — tight, per an explicit "no strong 3D" note.
 * - A plain CSS `hover:scale` on the OUTER wrapper so the gorget visibly
 *   reacts along with the helmet on hover (they're one illustration now, so
 *   this is automatic rather than a separate concern).
 * `(hover: hover) and (pointer: fine)` gates the wipe/tilt; touch/keyboard
 * users get a fixed, legible partial-haze rendering instead (the hover scale
 * still applies via `:focus-within` for keyboard users, since it's plain CSS).
 *
 * The pointermove listener only calls `motionValue.set(...)`, never a React
 * state setter — this sidesteps the render-thrashing that caused an earlier
 * custom-cursor version of this effect to be removed.
 */
export function HelmetReveal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const interactive = useFinePointer();
  const [hovering, setHovering] = useState(false);

  // Off-canvas resting position so the clear patch starts fully hidden.
  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const springConfig = { stiffness: 220, damping: 26, mass: 0.5 };
  const springX = useSpring(mx, springConfig);
  const springY = useSpring(my, springConfig);

  // Exhibit tilt: a museum-case parallax, capped tight (±MAX_TILT_DEG) so it
  // reads as the object slightly turning toward the viewer, never a 3D-card
  // gimmick — "максимум 1–2 градуса rotation, никакого сильного 3D".
  const MAX_TILT_DEG = 1.5;
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const springRX = useSpring(rx, springConfig);
  const springRY = useSpring(ry, springConfig);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !interactive) return;

    const unsubX = springX.on("change", (value) => {
      el.style.setProperty("--mx", `${value}px`);
    });
    const unsubY = springY.on("change", (value) => {
      el.style.setProperty("--my", `${value}px`);
    });
    const unsubRX = springRX.on("change", (value) => {
      el.style.setProperty("--rx", `${value}deg`);
    });
    const unsubRY = springRY.on("change", (value) => {
      el.style.setProperty("--ry", `${value}deg`);
    });
    return () => {
      unsubX();
      unsubY();
      unsubRX();
      unsubRY();
    };
  }, [interactive, springX, springY, springRX, springRY]);

  const wireUpReveal = interactive && !reduceMotion;

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!wireUpReveal) return;
    const rect = event.currentTarget.getBoundingClientRect();
    mx.set(event.clientX - rect.left);
    my.set(event.clientY - rect.top);
    const offsetX = (event.clientX - rect.left) / rect.width - 0.5;
    const offsetY = (event.clientY - rect.top) / rect.height - 0.5;
    ry.set(offsetX * 2 * MAX_TILT_DEG);
    rx.set(offsetY * -2 * MAX_TILT_DEG);
    setHovering(true);
  }

  function handlePointerLeave() {
    if (!wireUpReveal) return;
    mx.set(-100);
    my.set(-100);
    rx.set(0);
    ry.set(0);
    setHovering(false);
  }

  // Reduced-motion or coarse-pointer users: no tracking at all, just a fixed
  // legible mesh with a faint static texture.
  const staticFallback = !wireUpReveal;

  return (
    <div className="relative overflow-hidden border border-[var(--border-strong)] bg-[var(--surface-muted)] p-5">
      <span aria-hidden="true" className="tick" style={{ top: 10, left: 10, borderTop: "1.5px solid var(--gold)", borderLeft: "1.5px solid var(--gold)" }} />
      <span aria-hidden="true" className="tick" style={{ top: 10, right: 10, borderTop: "1.5px solid var(--gold)", borderRight: "1.5px solid var(--gold)" }} />
      <span aria-hidden="true" className="tick" style={{ bottom: 10, left: 10, borderBottom: "1.5px solid var(--gold)", borderLeft: "1.5px solid var(--gold)" }} />
      <span aria-hidden="true" className="tick" style={{ bottom: 10, right: 10, borderBottom: "1.5px solid var(--gold)", borderRight: "1.5px solid var(--gold)" }} />

      {/* outer wrapper — plain CSS hover/focus scale on the whole exhibit */}
      <div className="mx-auto flex w-52 flex-col items-center transition-transform duration-300 ease-out hover:scale-[1.03] focus-within:scale-[1.03]">
        <CalloutLabel text={MASK_ITEM.title} description={MASK_ITEM.desc} />
        <div
          ref={containerRef}
          className="relative mt-2 aspect-[100/130] w-52 select-none"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          style={
            {
              perspective: 700,
              "--mx": "-100px",
              "--my": "-100px",
              "--rx": "0deg",
              "--ry": "0deg",
            } as CSSProperties
          }
        >
          <div className="h-full w-full" style={{ transform: "rotateX(var(--rx)) rotateY(var(--ry))" }}>
            <GearMaskIllustration hovering={hovering} staticFallback={staticFallback} />
          </div>
        </div>
        <div className="mt-2 w-full">
          <CalloutLabel text={GORGET_ITEM.title} description={GORGET_ITEM.desc} />
        </div>
      </div>

      <div className="mt-5 flex items-baseline justify-between border-t border-[var(--border)] pt-3">
        <span className="record-label text-[var(--gold)]">Ил. 01</span>
        <span className="record-label text-[var(--muted)]">Защитное снаряжение</span>
      </div>
    </div>
  );
}

/** A thin technical callout: label + a marker dot on a trailing hairline
 *  ("МАСКА ────●"), then one short description line reusing `equipment-
 *  items.ts`'s own copy verbatim (never invented). */
function CalloutLabel({ text, description }: { text: string; description: string }) {
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="record-label text-[var(--gold)]">{text}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-[var(--gold)]" style={{ opacity: 0.4 }} />
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full border border-[var(--gold)]" style={{ opacity: 0.75 }} />
      </div>
      <p className="text-[0.6875rem] leading-snug text-[var(--text-3)]">{description}</p>
    </div>
  );
}
