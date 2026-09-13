import Link from "next/link";
import type { CSSProperties, ComponentProps } from "react";

import { RippleLabel } from "./ripple-label";

/**
 * The "← Назад к чему-то" eyebrow every detail page opens with.
 *
 * Used to be `.label-link label-link-back` (a scale-up plus a groove drawn
 * under the whole box, arrow included) — the groove starting under the arrow
 * glyph before the word even began read as smeared/crooked, and a follow-up
 * fix that trimmed the groove to just the word still left the scale+arrow
 * combination feeling "broken" on review. Replaced outright with the
 * footer's own hover language (`.footer-link` — a letter-by-letter ripple and
 * a rule drawn in step, see `RippleLabel` and globals.css) instead of a
 * fourth bespoke effect, per the site's own "reuse, don't invent" rule for
 * hovers. The arrow is a plain child span, not a pseudo-element sharing the
 * link's own background — see `.back-link-arrow` in globals.css for why that
 * specifically is what the old bug traced back to.
 */
export function BackLink({
  href,
  children,
  ...props
}: { href: string; children: string } & Omit<ComponentProps<typeof Link>, "href" | "children">) {
  return (
    <Link
      href={href}
      style={{ "--letters": children.length } as CSSProperties}
      className="footer-link back-link record-label inline-flex items-center"
      {...props}
    >
      <span aria-hidden="true" className="back-link-arrow">
        ←
      </span>
      <RippleLabel text={children} />
    </Link>
  );
}
