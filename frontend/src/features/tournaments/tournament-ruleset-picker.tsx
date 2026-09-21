"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { updateTournamentRuleset } from "@/api/tournaments";
import { Alert, Button } from "@/components/ui";
import { Field, Select } from "@/components/ui/form";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError, ApiUnreachableError } from "@/lib/api";
import { routes } from "@/lib/routes";
import type { RuleSet } from "@/types";

/**
 * Which edition of the rules this tournament points at — and, for whoever can
 * manage it, a way to change that.
 *
 * A tournament names exactly one ruleset at creation and, until this, never
 * again. Editing a redaction's own text or attaching its own file still only
 * happens on the ruleset's own page (`/rules/{id}`) — this picker only
 * chooses WHICH edition applies, it does not manage editions themselves.
 */
function describeError(error: unknown): string {
  if (error instanceof ApiUnreachableError) return "Не удалось связаться с API.";
  if (error instanceof ApiError) {
    if (error.status === 401) return "Требуется вход в систему.";
    if (error.status === 403) return "Менять регламент может организатор турнира.";
    if (error.status === 404) return "Эта редакция правил не найдена.";
    return error.message;
  }
  return "Не удалось сохранить регламент.";
}

export function TournamentRulesetPicker({
  tournamentId,
  ruleSets,
  currentRulesetId,
}: {
  tournamentId: string;
  /** Every edition that exists — the picker offers all of them, not only the current one. */
  ruleSets: RuleSet[];
  currentRulesetId: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState(currentRulesetId);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = ruleSets.find((candidate) => candidate.id === currentRulesetId) ?? null;
  const dirty = selected !== currentRulesetId;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateTournamentRuleset(tournamentId, selected);
      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(describeError(caught));
      setSelected(currentRulesetId);
    } finally {
      setSaving(false);
    }
  }

  // Same `.record-card` treatment for every visitor, signed in or not — a
  // bare `label-link` line here (what this replaced) read as visually
  // "empty" right next to the organizer's own boxed controls, even though
  // both are showing the same one fact. `current` can be null only when
  // `ruleset_id` points at nothing real, which should not happen but is a
  // broken link rather than a picker to offer.
  const viewCard = current ? (
    <Link
      href={routes.ruleSet(current.id)}
      className="record-card group flex items-center justify-between gap-3 self-stretch rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 focus-visible:shadow-[inset_0_0_0_2px_var(--gold)]"
    >
      {/* Two stacked lines, not one — a single line of text left the right
          two-thirds of the card empty at any width wider than a phone. The
          hint line wraps/truncates on its own rather than needing a
          breakpoint: `min-w-0` lets both lines shrink with the card, and
          `truncate` on each keeps the arrow from ever being pushed off the
          fixed-width card by a long title or a narrow viewport. */}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">
          {current.title}, версия {current.version}
        </span>
        <span className="truncate text-xs text-[var(--muted)]">
          Нажмите, чтобы открыть актуальную редакцию правил
        </span>
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]"
        strokeWidth={2.25}
      />
    </Link>
  ) : null;

  if (!user) return viewCard;

  const selectedRuleSet = ruleSets.find((candidate) => candidate.id === selected) ?? null;

  return (
    // overflow-x-clip (not hidden — hidden would also clip the Alert's own
    // margin/shadow and the Select's native dropdown) on this specific
    // wrapper only: at narrow widths this row can sit close enough to the
    // page edge that `.btn-primary`'s `.btn-stamp-ring` — which grows to
    // scale(1.9) on hover (see `stamp-ring` keyframes in globals.css) —
    // briefly paints past the viewport and opens a horizontal scrollbar for
    // the ~480ms the animation runs. Clipping here contains that bleed
    // without touching `html`/`body`, which would also clip the ring's
    // intentional bleed on every OTHER primary button on the site that
    // isn't sitting on an edge.
    <div className="space-y-2.5 overflow-x-clip overflow-y-visible">
      <div className="flex flex-wrap items-stretch gap-3">
        {/* Sized to its content, not stretched across the row: the select's
            own text already names the edition, so there is nothing left for
            a full-width box to hold other than empty space. */}
        <div className="w-auto min-w-56">
          {/* Label hidden, not reworded: this block sits directly under the
              page's own "Регламент" caption (`tournaments/[id]/page.tsx`) and
              holds exactly one field, so a second `record-label` caption right
              underneath — even a differently-worded one — still reads as
              duplicated metadata rather than a field name. Kept for screen
              readers via `hideLabel`, not removed outright. */}
          <Field label="Редакция" hideLabel>
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={selected}
                onChange={(event) => {
                  setSelected(event.target.value);
                  setSaved(false);
                }}
              >
                {ruleSets.map((ruleSet) => (
                  <option key={ruleSet.id} value={ruleSet.id}>
                    {ruleSet.title}, версия {ruleSet.version}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {/* Icon-only, not a second copy of the select's own text — the select
            already names the edition, so a same-width card repeating it back
            (the earlier version of this row) only doubled the width for no
            new information. This still opens whatever is currently picked,
            even before it's saved. */}
        <Link
          href={routes.ruleSet(selected)}
          title={selectedRuleSet ? `Открыть «${selectedRuleSet.title}, версия ${selectedRuleSet.version}»` : "Открыть редакцию"}
          aria-label="Открыть редакцию правил"
          className="record-card group flex shrink-0 items-center justify-center self-stretch rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 focus-visible:shadow-[inset_0_0_0_2px_var(--gold)]"
        >
          <ArrowRight
            className="size-4 shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]"
            strokeWidth={2.25}
          />
        </Link>
        {/* Only exists while there is something to confirm — the resting
            row is select + icon link, and this is the transient third piece
            that appears for exactly as long as the pick doesn't match what's
            actually saved. */}
        {dirty ? (
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </Button>
        ) : null}
      </div>
      {saved ? <Alert tone="success">Регламент обновлён.</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
