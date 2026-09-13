/**
 * Barrel re-export for wire types.
 *
 * Types live next to the domain they belong to — see the per-domain files in
 * this directory (`tournament.ts`, `athlete.ts`, `auth.ts`, `club.ts`,
 * `equipment.ts`, `rules.ts`, `education.ts`, `document.ts`). This file only
 * re-exports them so existing `import { X } from "@/types"` call sites keep
 * working unchanged. Add new types to the relevant domain file, not here —
 * this file should never grow beyond re-exports.
 */

export * from "./tournament";
export * from "./athlete";
export * from "./auth";
export * from "./club";
export * from "./equipment";
export * from "./rules";
export * from "./education";
export * from "./document";
