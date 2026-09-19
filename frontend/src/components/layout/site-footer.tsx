import Link from "next/link";
import { type CSSProperties, type ComponentType } from "react";

import { AnnalIcon } from "@/components/brand/annal-icon";
import { BracketIcon } from "@/components/brand/bracket-icon";
import { MaskMark } from "@/components/brand/mask-mark";
import { RippleLabel } from "@/components/brand/ripple-label";
import { SiteLogo } from "@/components/brand/site-logo";
import { SashIcon } from "@/components/brand/sash-icon";
import { UstavIcon } from "@/components/brand/ustav-icon";
import { Container } from "@/components/ui";
import { routes } from "@/lib/routes";
import { FooterBottomRow } from "./footer-bottom-row";
import { FooterSeals } from "./footer-seals";

/**
 * Each link carries the mark that already stands for that place on the margin
 * river — the bracket for the draw, the устав for the regulations, the helmet
 * for the fighters, the опаска for the clubs, the annal for what is taught.
 *
 * Deliberately *not* the four weapon motifs the header flips to. Those were
 * hand-picked by label width (see `NAV_WEAPON` in `site-header.tsx`, where
 * «Безоружный» goes on «Клубы» because it is the longest of the four and an
 * edge item would overhang the header) — they say nothing about the section
 * they sit on. The river's marks do: each one is already the sign of that
 * section elsewhere on the site, so lighting it here repeats a statement
 * instead of inventing a decorative one.
 */
type FooterLink = {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
};

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Соревнования",
    links: [
      { href: routes.tournaments(), label: "Турниры", Icon: BracketIcon },
      { href: routes.rules(), label: "Правила и регламенты", Icon: UstavIcon },
    ],
  },
  {
    title: "Сообщество",
    links: [
      { href: routes.athletes(), label: "Спортсмены", Icon: MaskMark },
      { href: routes.clubs(), label: "Клубы", Icon: SashIcon },
    ],
  },
  {
    title: "Развитие",
    links: [{ href: routes.education(), label: "Обучение", Icon: AnnalIcon }],
  },
];

/* `RippleLabel` moved to `components/brand/ripple-label.tsx` so the same
   "как в подвале" hover — letter ripple + rule drawn in step — can be reused
   outside the footer (see `BackLink` in `components/brand/back-link.tsx`). */

/**
 * Colophon rather than a sitemap footer: a cold double rule closes the
 * document, columns are headed with stamped field labels, and the seal row is
 * the one place the four motifs appear as a set — the same frame used
 * everywhere else, so it reads as the issuing mark of the archive instead of a
 * strip of decorative icons.
 */
export function SiteFooter() {
  return (
    // `mt-6`, not the `mt-10` this used to be (itself trimmed down from
    // `mt-14`): every page already ends with its own `py-10` bottom padding
    // (from `Container`), so the two stacked together kept reading as
    // noticeably more dead space before the footer than after the header, on
    // every page site-wide — most visible on a page whose last section is
    // short (a single empty-state line, say). Trimmed here (the footer's own
    // margin) rather than on `Container`, which also sets the gap *under*
    // the header — that one wasn't the complaint.
    <footer className="mt-6 bg-[var(--background-deep)]">
      <Container>
        {/* `pt-3`, not the `pt-8` this used to be: the line itself is ~3px
            tall (see `.rule-double` in globals.css), so the rest of that
            padding was pure dead space before the columns below even start
            their own `py-10` top padding — the two stacked read as too much
            gap right under the rule specifically (not the gap under the
            header, which nobody flagged). */}
        <div className="rule-double pt-3" />
      </Container>

      <Container className="grid gap-10 py-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div className="space-y-4">
          {/* `SiteLogo` — the actual logo (link home, hover reveal, tap
              reveal, the click-triggered сшибка), not a static lookalike
              built from the same pieces: this used to be a bare `Monogram`
              glyph with no badge plate and no behaviour at all, which read
              as a different, lighter-weight mark than the header's own.
              `variant="slide"` answers the hover with a page leafing past
              rather than a plate flipping over — the same cycling-to-a-
              weapon gesture, a visibly different one, so the footer's copy
              doesn't read as a literal duplicate of the header's motion. */}
          <SiteLogo size={20} variant="slide" />
          <p className="max-w-xs text-sm leading-relaxed text-[var(--muted)]">
            Цифровая платформа сообщества: обучение, правила, турниры, клубы и снаряжение.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="space-y-3">
            <p className="record-label border-b border-[var(--border-strong)] pb-2 text-[var(--chrome-muted)]">
              {column.title}
            </p>
            {/* `inline-flex` with a 24px minimum height, not a bare inline
                link: at `text-sm` the line box is 17px tall, which is a target
                a fingertip misses as often as it hits. The row spacing drops
                to compensate, so the column takes the same room it did. */}
            <ul className="space-y-0.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    /* `--letters` lets the rule underneath run for exactly as
                       long as the ripple crossing the word above it, so the two
                       finish together whether the label is «Клубы» or «Правила
                       и регламенты». */
                    style={{ "--letters": link.label.length } as CSSProperties}
                    className="footer-link inline-flex min-h-6 items-center text-sm"
                  >
                    {/* The mark stands in the grid gap to the left of the
                        column, so nothing reflows when it appears and no word
                        moves sideways — the ripple is the word's own movement
                        and a second one across it would read as a stumble.
                        Hidden below `md`, where the columns stack against the
                        container's own padding and there is no gap to stand in. */}
                    <span aria-hidden="true" className="footer-link-mark hidden md:block">
                      <link.Icon size={14} />
                    </span>
                    <RippleLabel text={link.label} />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>

      <FooterBottomRow>
        <p className="font-record text-[0.7rem] uppercase tracking-[0.14em] text-[var(--muted)]">
          © {new Date().getFullYear()} · Мстинская традиция
        </p>
        <FooterSeals />
      </FooterBottomRow>
    </footer>
  );
}
