import { ViewTransition } from "react";

/**
 * Wraps a page's content so `nav-forward`/`nav-back` `transitionTypes` on the
 * `<Link>` that navigated here (or `router.push(href, { transitionTypes })`)
 * produce a directional slide — see `globals.css`'s `.nav-forward`/`.nav-back`
 * view-transition rules. `default="none"` keeps this silent on every other
 * transition (Suspense reveals, browser back/forward, `router.refresh()`).
 *
 * Must be the outermost node a page returns (React only fires enter/exit for
 * a `<ViewTransition>` that isn't itself wrapped by another DOM node), and
 * belongs in each participating `page.tsx`, never in a layout — layouts
 * persist across navigation, so their `enter`/`exit` never fire.
 */
export function DirectionalTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
