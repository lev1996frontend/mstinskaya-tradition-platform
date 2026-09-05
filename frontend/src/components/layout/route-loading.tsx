import { Emblem } from "@/components/brand/emblem";
import { Seal } from "@/components/brand/seal";
import { Container } from "@/components/ui";

/**
 * Печать — what the archive shows while a page is being fetched.
 *
 * Moving between sections used to give no sign that anything was happening:
 * the routes read live data on the server (`cache: "no-store"`), so the old
 * page simply stood there until the new one was ready. This is the shared
 * fallback for that wait.
 *
 * A seal being struck rather than a spinner: the mark is pressed into the
 * page, a ring travels round the outside the way a stamp is worked, and the
 * emblem breathes under it. The furniture is the site's own — `Seal`'s
 * octagon and the real club `Emblem` — so the wait looks like part of the
 * archive rather than like a widget borrowed from somewhere else.
 *
 * It sits in the page body, under the header and beside the margin river,
 * instead of covering the screen: a section is being turned to, not the whole
 * site blocked, and both of those stay usable while it happens.
 *
 * Not the boat from the margin river, which shows how far down a page the
 * reader is — giving it a second job is a mistake this codebase has already
 * made and undone once.
 */
export function RouteLoading({ label = "Поднимаем лист" }: { label?: string }) {
  return (
    <Container className="py-24 sm:py-32">
      {/* `role="status"` with a polite live region: a sighted reader has the
          seal, and everyone else should be told the page is on its way rather
          than meeting silence. */}
      <div role="status" aria-live="polite" className="grid place-items-center gap-6">
        <span className="loading-seal relative inline-grid place-items-center" style={{ width: 132, height: 132 }}>
          <svg
            aria-hidden="true"
            viewBox="0 0 132 132"
            fill="none"
            className="loading-seal-arc absolute inset-0 h-full w-full"
          >
            {/* The bed the stamp is worked against. */}
            <circle cx="66" cy="66" r="62" stroke="var(--iron)" strokeWidth="1" opacity="0.7" />
            {/* One travelling segment. Dash and gap add up to the circle's own
                circumference (2π×62 ≈ 390), so there is exactly one of it —
                a stray second segment coming round is the giveaway that this
                arithmetic has drifted. */}
            <circle
              cx="66"
              cy="66"
              r="62"
              stroke="var(--gold)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeDasharray="44 346"
            />
          </svg>
          <span className="loading-seal-mark">
            <Seal size={104} tone="iron">
              {/* Stated, not inherited: `Seal`'s tone paints its own frame, and
                  the mark itself is the club's and shouldn't take the frame's
                  colour. It also needs real size — this emblem turns to mud
                  much under ~34px. */}
              <Emblem size={44} className="text-[var(--foreground)]" />
            </Seal>
          </span>
        </span>
        <span className="record-label text-[var(--text-4)]">{label}</span>
      </div>
    </Container>
  );
}
