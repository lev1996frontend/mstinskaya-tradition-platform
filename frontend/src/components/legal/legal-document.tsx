import { Container, PageHeader } from "@/components/ui";

export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

/**
 * Shared shell for the privacy policy / cookie policy / terms of use pages —
 * identical structure three times over (numbered sections, same prose
 * treatment `/rules/[id]` already uses for long-form text), so it is one
 * component rather than three copies drifting apart.
 */
export function LegalDocument({
  eyebrow,
  title,
  updated,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  /** e.g. "19 сентября 2026" — shown under the title so a reader can tell
   *  whether they've read the current version. */
  updated: string;
  intro?: string;
  sections: LegalSection[];
}) {
  return (
    <Container className="max-w-3xl space-y-8 pt-10 pb-14">
      <PageHeader eyebrow={eyebrow} title={title} />
      <p className="text-sm text-[var(--muted)]">Действует с {updated}.</p>
      {intro ? <p className="text-sm leading-relaxed text-[var(--muted)]">{intro}</p> : null}

      <ol className="space-y-8">
        {sections.map((section, index) => (
          <li key={section.heading} className="space-y-2 border-t border-[var(--border)] pt-6">
            <h2 className="font-display text-lg font-semibold leading-snug tracking-tight">
              {String(index + 1).padStart(2, "0")}. {section.heading}
            </h2>
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <p
                key={paragraphIndex}
                className="whitespace-pre-line text-sm leading-relaxed text-[var(--muted)]"
              >
                {paragraph}
              </p>
            ))}
          </li>
        ))}
      </ol>
    </Container>
  );
}
