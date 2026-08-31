"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "./cn";

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
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-medium tracking-[0.01em] transition-colors disabled:cursor-not-allowed disabled:opacity-55";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "border-b-2 border-[var(--accent-strong)] bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]",
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
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.12 }}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    >
      {icon && iconPosition === "start" ? icon : null}
      {children}
      {icon && iconPosition === "end" ? icon : null}
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
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.12 }}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    >
      {icon && iconPosition === "start" ? icon : null}
      {children}
      {icon && iconPosition === "end" ? icon : null}
    </MotionLink>
  );
}
