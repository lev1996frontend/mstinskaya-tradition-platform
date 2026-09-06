import type Lenis from "lenis";

/**
 * Module-level handle on the running Lenis instance.
 *
 * Exists so that components which merely *use* smooth scrolling (currently
 * `ScrollToTop`) don't have to `import { useLenis } from "lenis/react"`.
 * That import is the reason Lenis — and, transitively, the GSAP bundle it is
 * driven by — used to land in the shared client chunk of every route,
 * including text-only pages like `/rules` that have no scroll animation at
 * all. Smooth scroll is now mounted lazily (`smooth-scroll-mount.tsx`), and
 * this file is the seam that keeps consumers free of the library itself:
 * `import type` is erased at compile time, so nothing here pulls Lenis into
 * the bundle of whoever reads the instance.
 *
 * Lenis's own `useLenis` would in fact still resolve without a wrapping
 * provider — in `root` mode the react bindings publish the instance to a
 * module-level store of their own — but reading it through that hook is
 * exactly the import we are trying to avoid.
 */
type LenisInstance = Lenis;

let current: LenisInstance | null = null;
const listeners = new Set<() => void>();

/** Called by the lazily-mounted smooth-scroll root as it starts and stops. */
export function publishLenis(instance: LenisInstance | null) {
  if (current === instance) return;
  current = instance;
  for (const listener of listeners) listener();
}

export function getLenis(): LenisInstance | null {
  return current;
}

/** Server snapshot: there is no Lenis instance during a server render. */
export function getLenisServerSnapshot(): LenisInstance | null {
  return null;
}

export function subscribeLenis(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
