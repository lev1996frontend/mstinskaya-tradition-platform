import { Fragment, type CSSProperties } from "react";

/**
 * The label, cut into letters so a ripple can run along it.
 *
 * Extracted from the footer (its original and only home) so the same "как в
 * подвале" hover — a letter-by-letter rise, a rule drawn underneath in step
 * with it — can be reused wherever a quiet text link wants that language
 * instead of `.label-link`'s scale-and-groove. Deliberately reuses the
 * footer's own `.footer-link-word`/`.footer-link-letter` class names rather
 * than inventing parallel ones: the mechanics (see `.footer-link` in
 * globals.css) are meant to be identical, not merely similar, and a second
 * copy of the same keyframes/timing under a new name would drift from this
 * one the first time either was tuned.
 *
 * Split by words first and each word set `inline-block`, with the spaces left
 * as plain text between them: letters on their own would let a line break
 * fall anywhere.
 *
 * The lettered copy is `aria-hidden` with the whole label repeated in an
 * `sr-only` span beside it. A link's accessible name would technically still
 * come out right from the spans alone, but several screen readers spell out
 * text broken into one element per character, and this is navigation — it
 * has to be read as words.
 */
export function RippleLabel({ text }: { text: string }) {
  const words = text.split(" ");
  /* Each word's index into the whole label, so the ripple's delays carry on
     across the spaces instead of restarting at every word. Counted from the
     words before it rather than a running total: a binding reassigned during
     render is what `react-hooks/immutability` is there to catch. */
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
