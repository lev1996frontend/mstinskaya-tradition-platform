import Link from "next/link";
import { Fragment, type CSSProperties, type ComponentType } from "react";

import { AnnalIcon } from "@/components/brand/annal-icon";
import { BracketIcon } from "@/components/brand/bracket-icon";
import { MaskMark } from "@/components/brand/mask-mark";
import { Monogram } from "@/components/brand/monogram";
import { SashIcon } from "@/components/brand/sash-icon";
import { UstavIcon } from "@/components/brand/ustav-icon";
import { Container } from "@/components/ui";
import { FooterSeals } from "./footer-seals";
import { FooterToTop } from "./footer-to-top";

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
      { href: "/tournaments", label: "Турниры", Icon: BracketIcon },
      { href: "/rules", label: "Правила и регламенты", Icon: UstavIcon },
    ],
  },
  {
    title: "Сообщество",
    links: [
      { href: "/athletes", label: "Спортсмены", Icon: MaskMark },
      { href: "/clubs", label: "Клубы", Icon: SashIcon },
    ],
  },
  {
    title: "Развитие",
    links: [{ href: "/education", label: "Обучение", Icon: AnnalIcon }],
  },
];

/**
 * The label, cut into letters so a ripple can run along it.
 *
 * Split by words first and each word set `inline-block`, with the spaces left
 * as plain text between them: letters on their own would let a line break fall
 * anywhere, and «Правила и регламенты» is long enough to wrap in its column.
 * This way it still breaks at spaces and nowhere else.
 *
 * The lettered copy is `aria-hidden` with the whole label repeated in an
 * `sr-only` span beside it. A link's accessible name would technically still
 * come out right from the spans alone, but several screen readers spell out
 * text broken into one element per character, and this is navigation — it has
 * to be read as words.
 */
function RippleLabel({ text }: { text: string }) {
  const words = text.split(" ");
  /* Each word's index into the whole label, so the ripple's delays carry on
     across the spaces instead of restarting at every word. Counted from the
     words before it rather than a running total: a binding reassigned during
     render is what `react-hooks/immutability` is there to catch, and no label
     here is more than three words long. */
  const parts = words.map((word, index) => ({
    word,
    start: words.slice(0, index).reduce((sum, previous) => sum + previous.length + 1, 0),
  }));

  return (
    <>
      <span aria-hidden="true">
        {parts.map(({ word, start }, index) => (
          <Fragment key={`${word}-${start}`}>
            {index > 0 ? " " : null}
            <span className="footer-link-word">
              {[...word].map((char, offset) => (
                <span
                  key={`${start}-${offset}`}
                  className="footer-link-letter"
                  style={{ "--i": start + offset } as CSSProperties}
                >
                  {char}
                </span>
              ))}
            </span>
          </Fragment>
        ))}
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}

/**
 * Colophon rather than a sitemap footer: a cold double rule closes the
 * document, columns are headed with stamped field labels, and the seal row is
 * the one place the four motifs appear as a set — the same frame used
 * everywhere else, so it reads as the issuing mark of the archive instead of a
 * strip of decorative icons.
 */
export function SiteFooter() {
  return (
    <footer className="mt-14 bg-[var(--background-deep)]">
      <Container>
        <div className="rule-double pt-8" />
      </Container>

      <Container className="grid gap-10 py-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <Monogram size={20} className="text-[var(--accent)]" />
            <span className="leading-tight">
              <span className="font-display block text-[0.9375rem] font-semibold">Мстинская</span>
              <span className="font-record block text-[0.6rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                традиция
              </span>
            </span>
          </div>
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

      <Container className="flex flex-col gap-5 border-t border-[var(--border-strong)] py-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-record text-[0.7rem] uppercase tracking-[0.14em] text-[var(--muted)]">
          © {new Date().getFullYear()} · Мстинская традиция
        </p>
        {/* Seals and «Наверх» travel together, so the row needs no breakpoint of
            its own: stacked (below `sm`) they take the line the copyright left
            behind, the marks at one end and the way up at the other; in a row
            they close ranks at the right end beside it. */}
        <div className="flex items-center justify-between gap-6 sm:justify-end">
          <FooterSeals />
          <FooterToTop />
        </div>
      </Container>
    </footer>
  );
}
