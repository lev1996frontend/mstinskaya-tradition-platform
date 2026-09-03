"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "./cn";
import { IMPULSE_SPRING, STOP_SPRING } from "@/lib/motion";

/**
 * Interactive button primitives live in their own client file (motion needs a
 * browser) so the rest of `components/ui` — Container, Card, tables, etc. —
 * can stay server-renderable with zero client JS.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

// Square-cut and slightly letterspaced: a button in this system is a key
// pressed on a form, not a rounded SaaS pill. Depth is a 1px printed offset
// (border-b) rather than a drop shadow.
const buttonBase =
  "relative inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-medium tracking-[0.01em] transition-[background-color,border-color,box-shadow,color] duration-[var(--duration-fast)] ease-[var(--ease-out)] disabled:cursor-not-allowed disabled:opacity-55";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "btn-primary border-b-2 border-[var(--accent-strong)] bg-[var(--accent)] text-white shadow-[0_1px_0_rgba(0,0,0,0.5)] hover:bg-[var(--accent-strong)] hover:shadow-[0_10px_20px_-12px_rgba(176,42,32,0.45)]",
  secondary:
    "border border-[var(--chrome-line)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--chrome-muted)] hover:bg-[var(--surface-muted)]",
  ghost: "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
  danger: "border-b-2 border-[var(--accent-strong)] bg-[var(--danger)] text-white hover:opacity-90",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
  lg: "px-5 py-2.5 text-[0.9375rem]",
};

// тиснение: the button lifts a hair on hover and (primary only) an ink-ring
// presses out from its edge in --gold — the same "stamp, not colour swap"
// gesture as the dossier cards and the scroll-to-top arrow (see
// .btn-stamp-ring in globals.css), extended here to the primary CTAs.
const liftVariants = { hover: { y: -1, scale: 1.012, transition: STOP_SPRING } };
const iconHoverVariants = { hover: { scale: 1.15, transition: IMPULSE_SPRING } };

function IconSlot({ icon, reduceMotion }: { icon: ReactNode; reduceMotion: boolean | null }) {
  if (reduceMotion) return <>{icon}</>;
  return (
    <motion.span className="inline-flex" variants={iconHoverVariants}>
      {icon}
    </motion.span>
  );
}

type IconProps = {
  icon?: ReactNode;
  iconPosition?: "start" | "end";
};

// framer-motion's HTMLMotionProps redefines a handful of DOM event handlers
// (onAnimationStart/End, onDrag*) with its own animation-oriented signatures,
// which collide with the plain DOM typings from ComponentProps. Omitting
// them here keeps consumers on the standard <button>/<a> event types for
// everything else.
type MotionConflictKeys =
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragExit"
  | "onDragLeave"
  | "onDragOver"
  | "onDrop";

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "start",
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, MotionConflictKeys> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
} & IconProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      whileHover={reduceMotion ? undefined : "hover"}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      variants={reduceMotion ? undefined : liftVariants}
      transition={{ duration: 0.12 }}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    >
      {variant === "primary" && !reduceMotion ? <span aria-hidden="true" className="btn-stamp-ring" /> : null}
      {icon && iconPosition === "start" ? <IconSlot icon={icon} reduceMotion={reduceMotion} /> : null}
      {children}
      {icon && iconPosition === "end" ? <IconSlot icon={icon} reduceMotion={reduceMotion} /> : null}
    </motion.button>
  );
}

const MotionLink = motion.create(Link);

export function ButtonLink({
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "start",
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, MotionConflictKeys> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
} & IconProps) {
  const reduceMotion = useReducedMotion();
  return (
    <MotionLink
      whileHover={reduceMotion ? undefined : "hover"}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      variants={reduceMotion ? undefined : liftVariants}
      transition={{ duration: 0.12 }}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    >
      {variant === "primary" && !reduceMotion ? <span aria-hidden="true" className="btn-stamp-ring" /> : null}
      {icon && iconPosition === "start" ? <IconSlot icon={icon} reduceMotion={reduceMotion} /> : null}
      {children}
      {icon && iconPosition === "end" ? <IconSlot icon={icon} reduceMotion={reduceMotion} /> : null}
    </MotionLink>
  );
}
