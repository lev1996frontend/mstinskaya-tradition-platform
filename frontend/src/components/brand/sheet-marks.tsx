/**
 * The three kinds of paper the platform hands out and takes back: a ruled
 * spreadsheet, a lined document, a struck-and-final PDF.
 *
 * Drawn rather than borrowed. The obvious alternative — the green/blue/red
 * badges everyone recognizes — would put three other companies' identities in
 * the middle of an archive, and would be the only place on the site where a
 * color means a vendor rather than a state. These follow the same rules as
 * `WeaponGlyphs`: one thin stroke, `currentColor`, no fill, no brand.
 *
 * One sheet outline for all three, with a different thing written on it, so
 * they read as one issued set rather than three loose icons:
 *
 * * **XLSX** — ruled into cells, the way a разграфлённый лист is.
 * * **DOCX** — lines of writing, ragged at the end like real text.
 * * **PDF** — a struck corner mark: a PDF is the copy that can no longer be
 *   edited, which is what a seal has always meant on paper.
 */

type GlyphProps = { className?: string; size?: number };

/** The sheet every mark is drawn on: a leaf of paper with its corner turned. */
function Sheet({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <path
        d="M5.5 2.75 H14 L18.5 7.25 V21.25 H5.5 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2.75 V7.25 H18.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      {children}
    </>
  );
}

function Mark({ className, size = 24, children }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <Sheet>{children}</Sheet>
    </svg>
  );
}

/** A spreadsheet: the sheet ruled into cells. */
export function SheetGridMark(props: GlyphProps) {
  return (
    <Mark {...props}>
      <path
        d="M8 11.4 H16 M8 15 H16 M8 18.4 H16"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M11.2 11.4 V18.4 M13.9 11.4 V18.4"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </Mark>
  );
}

/** A document: the sheet with lines of writing on it. */
export function SheetLinedMark(props: GlyphProps) {
  return (
    <Mark {...props}>
      <path
        d="M8 11.4 H15.5 M8 14.2 H16 M8 17 H15 M8 19.8 H12.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </Mark>
  );
}

/** A PDF: the sheet, struck. The octagon is the `Seal`'s own geometry, small. */
export function SheetSealedMark(props: GlyphProps) {
  return (
    <Mark {...props}>
      <path
        d="M8 11.4 H15.5 M8 14.2 H13.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M13.32 15.9 L15.68 15.9 L17.35 17.57 L17.35 19.93 L15.68 21.6 L13.32 21.6 L11.65 19.93 L11.65 17.57 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </Mark>
  );
}

export type SheetFormat = "xlsx" | "docx" | "pdf" | "other";

const MARK_BY_FORMAT = {
  xlsx: SheetGridMark,
  docx: SheetLinedMark,
  pdf: SheetSealedMark,
  other: SheetLinedMark,
} as const;

/**
 * What kind of paper a file name names.
 *
 * Deliberately generous about the older extensions: a coach who sends a `.doc`
 * or an `.xls` should see the right mark next to the error telling them to
 * re-save, not a shrug.
 */
export function formatOf(name: string | null | undefined): SheetFormat {
  const lowered = (name ?? "").toLowerCase();
  if (/\.(xlsx|xlsm|xls|csv)$/.test(lowered)) return "xlsx";
  if (/\.(docx|doc|rtf|odt)$/.test(lowered)) return "docx";
  if (/\.pdf$/.test(lowered)) return "pdf";
  return "other";
}

/** The mark for a file, chosen by its name. */
export function SheetMark({
  name,
  className,
  size = 16,
}: {
  name: string | null | undefined;
  className?: string;
  size?: number;
}) {
  const Glyph = MARK_BY_FORMAT[formatOf(name)];
  return <Glyph className={className} size={size} />;
}
