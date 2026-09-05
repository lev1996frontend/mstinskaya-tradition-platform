/**
 * Кружка — plain handled mug, a cylindrical cup rather than a stemmed goblet:
 * "буза" is a drink, but a goblet reads as wine in a way this shouldn't lean
 * into. Same single-colour `currentColor` line/fill language as `BoatIcon` and
 * `weapon-glyphs.tsx`.
 *
 * Kept beside `BoatIcon` rather than inside its one caller — the margin
 * river's landing (`components/layout/river-spine.tsx`) — so the three symbols
 * of the word stay one family in one folder.
 */
export function MugIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 24) / 22} viewBox="0 0 22 24" fill="none" aria-hidden="true">
      <path d="M4 5 H15 V17 C15 19.2 13.2 21 11 21 H8 C5.8 21 4 19.2 4 17 Z" fill="currentColor" opacity="0.9" />
      <path
        d="M15 8 H16.5 C18 8 19 9 19 10.5 C19 12 18 13 16.5 13 H15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M4 5 H15" stroke="currentColor" strokeWidth="1.3" opacity="0.6" />
    </svg>
  );
}
