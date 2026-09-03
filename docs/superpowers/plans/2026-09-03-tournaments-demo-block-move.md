# Tournament Demo Block Move (Stage 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the interactive tournament-walkthrough demo (Поединок → Сетка → Правила-квиз → Бойцы) from the homepage (`/`) to the real tournaments page (`/tournaments`), so it sits next to the real tournament list it explains instead of living on the landing page.

**Architecture:** Pure frontend reorganization, no backend/API changes. The four demo components already share one `TournamentPathProvider` and move as a single unit. Their source directory is renamed from `features/home/tournament-path/` to `features/tournaments/tournament-path/` to match their new home, then the render block is cut from `app/page.tsx` and pasted into `app/tournaments/page.tsx` below the real tournament list (as a sibling, not nested inside the existing `Container`, matching how these components already lay themselves out full-bleed).

**Tech Stack:** Next.js App Router, TypeScript, React 19, Tailwind v4. No test runner exists in this project (`frontend/package.json` has no `test` script and there are no `*.test.*` files) — verification is `npx tsc --noEmit`, `npm run lint`, and manual checks in the dev server (`npm run dev`), per this project's established pattern for frontend work.

**Spec:** `docs/superpowers/specs/2026-09-03-homepage-ia-restructure-design.md` (Этап 1 / Stage 1 of that spec — Stage 2 `/equipment` split and Stage 3 `SectionIndex`/header cleanup are separate follow-up plans, out of scope here).

## Global Constraints

- No backend changes — this plan touches only files under `frontend/src/`.
- The four demo components (`Poedinok`, `BracketGrid`, `RulesQuiz`, `Dossiers`) move and render together, wrapped in one `TournamentPathProvider` — never split apart (they share `TournamentPathState`, e.g. "заявленный разряд").
- `RulesQuiz`'s quiz content is already confirmed against the real ruleset (buza.su primary source per its own file comment) — do not alter the quiz questions/answers, only add a link out.
- Every task ends with `npx tsc --noEmit` passing (run from `frontend/`) before commit.

---

### Task 1: Rename `tournament-path/` directory to live under `features/tournaments/`

Pure rename, zero behavior change — isolates file-move risk from the actual content move in Task 2. After this task the homepage renders exactly as before, just importing from the new path.

**Files:**
- Move: `frontend/src/features/home/tournament-path/` (10 files: `bracket-data.ts`, `bracket-grid.tsx`, `dossiers.tsx`, `fighter-card.tsx`, `journal-panel.tsx`, `kinetic-name.tsx`, `lot-cube.tsx`, `poedinok.tsx`, `rules-quiz.tsx`, `tournament-path-context.tsx`) → `frontend/src/features/tournaments/tournament-path/`
- Modify: `frontend/src/app/page.tsx` (5 import lines, currently lines 14-18)
- Modify: `frontend/src/components/brand/weapon-glyphs.tsx` (1 comment line, currently line 116)

**Interfaces:**
- Produces: all 10 files now resolve under `@/features/tournaments/tournament-path/*` instead of `@/features/home/tournament-path/*`. No exported names change.

- [ ] **Step 1: Move the directory with git so history is preserved**

```bash
cd frontend
git mv src/features/home/tournament-path src/features/tournaments/tournament-path
```

- [ ] **Step 2: Update the 5 import paths in `frontend/src/app/page.tsx`**

Find:
```tsx
import { BracketGrid } from "@/features/home/tournament-path/bracket-grid";
import { Dossiers } from "@/features/home/tournament-path/dossiers";
import { Poedinok } from "@/features/home/tournament-path/poedinok";
import { RulesQuiz } from "@/features/home/tournament-path/rules-quiz";
import { TournamentPathProvider } from "@/features/home/tournament-path/tournament-path-context";
```

Replace with:
```tsx
import { BracketGrid } from "@/features/tournaments/tournament-path/bracket-grid";
import { Dossiers } from "@/features/tournaments/tournament-path/dossiers";
import { Poedinok } from "@/features/tournaments/tournament-path/poedinok";
import { RulesQuiz } from "@/features/tournaments/tournament-path/rules-quiz";
import { TournamentPathProvider } from "@/features/tournaments/tournament-path/tournament-path-context";
```

- [ ] **Step 3: Update the stale path in the `weapon-glyphs.tsx` comment**

In `frontend/src/components/brand/weapon-glyphs.tsx`, find (inside the doc comment above `WEAPON_MOTIFS`):
```
 * component in `features/home/tournament-path/` — it imports `KrugIcon`/
```

Replace with:
```
 * component in `features/tournaments/tournament-path/` — it imports `KrugIcon`/
```

- [ ] **Step 4: Verify the move compiles clean**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (no output, exit code 0).

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 5: Visual check — homepage unchanged**

Run: `cd frontend && npm run dev`, open `http://localhost:3000/`.
Expected: page looks pixel-identical to before this task — the demo block (Поединок/Сетка/Правила/Бойцы) still renders on the homepage, in the same place, fully interactive. This task only moved files, it did not move content yet.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(frontend): move tournament-path demo under features/tournaments

Pure rename ahead of relocating the demo block itself to /tournaments —
the components no longer belong under features/home/.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Move the demo block's render from the homepage to `/tournaments`

**Files:**
- Modify: `frontend/src/app/page.tsx` (remove the 5 imports added-back in Task 1 and the `TournamentPathProvider` JSX block; update the file's top doc comment)
- Modify: `frontend/src/app/tournaments/page.tsx` (add the same 5 imports; render the block below the existing `<Container>`)
- Modify: `frontend/src/features/tournaments/tournament-path/poedinok.tsx` (the demo's own "see the tournaments page" link becomes self-referential once it lives on that page — replace it with plain text, and drop the now-unused `Link` import)

**Interfaces:**
- Consumes: `TournamentPathProvider`, `Poedinok`, `BracketGrid`, `RulesQuiz`, `Dossiers` from `@/features/tournaments/tournament-path/*` (Task 1's paths).
- No new exports — this task only relocates existing JSX.

- [ ] **Step 1: Remove the demo block and its imports from `frontend/src/app/page.tsx`**

Delete these 5 lines from the import block:
```tsx
import { BracketGrid } from "@/features/tournaments/tournament-path/bracket-grid";
import { Dossiers } from "@/features/tournaments/tournament-path/dossiers";
import { Poedinok } from "@/features/tournaments/tournament-path/poedinok";
import { RulesQuiz } from "@/features/tournaments/tournament-path/rules-quiz";
import { TournamentPathProvider } from "@/features/tournaments/tournament-path/tournament-path-context";
```

Delete this JSX block (between `<StenkaKrug />` and `<Equipment rules={boutRules} />`):
```tsx
      <TournamentPathProvider>
        <Poedinok />
        <BracketGrid />
        <RulesQuiz />
        <Dossiers />
      </TournamentPathProvider>

```

- [ ] **Step 2: Update `HomePage`'s doc comment in `frontend/src/app/page.tsx`**

Find:
```tsx
/**
 * Front page of the archive — the "Живой архив" v3 redesign
 * (design_handoff_mstinskaya). Masthead, the real live-tournament bulletin,
 * then БУЗА (design_handoff_buza_river — the tradition's origin story,
 * collapsed by default and opened only by the river-boat button in the
 * header; see `features/home/buza-context.tsx`), then the new demo/editorial
 * sections (СТЕНКА → ПОЕДИНОК/СЕТКА/ПРАВИЛА/БОЙЦЫ → СНАРЯЖЕНИЕ → АРХИВ
 * ЭКИПИРОВКИ → ХРОНИКА → ЖИВОПИСЬ), closing with the new anchor index.
 * ПОЕДИНОК/СЕТКА/БОЙЦЫ share one `TournamentPathProvider`
 * — the "заявленный разряд" state and the fixed demo bracket must stay one
 * source of truth across all three (see `tournament-path/bracket-data.ts`),
 * even though ПРАВИЛА сидит между them with no state of its own.
 *
 * СНАРЯЖЕНИЕ (`Equipment`, real bout-rules data — the four lot-drawn weapon
 * categories) and АРХИВ ЭКИПИРОВКИ (`GearArchive`, the nine-item опись a
 * fighter wears regardless of category) sit next to each other on purpose —
 * two different опись, "чем бьются" then "во что одет", not one merged into
 * the other.
 *
 * The previous `DirectoryIndex` (real-route ToC) is no longer rendered here:
 * with 12 detailed sections plus the new anchor `SectionIndex`, a second
 * "here are five more pages" block read as redundant, and all five routes
 * stay one click away via the header nav. The component itself is left
 * untouched in `features/home/directory-index.tsx` rather than deleted.
 */
```

Replace with:
```tsx
/**
 * Front page of the archive — the "Живой архив" v3 redesign
 * (design_handoff_mstinskaya). Masthead, the real live-tournament bulletin,
 * then БУЗА (design_handoff_buza_river — the tradition's origin story,
 * collapsed by default and opened only by the river-boat button in the
 * header; see `features/home/buza-context.tsx`), then the editorial sections
 * (СТЕНКА/КРУГ → СНАРЯЖЕНИЕ → АРХИВ ЭКИПИРОВКИ → ХРОНИКА → ЖИВОПИСЬ), closing
 * with the anchor index. The interactive tournament walkthrough (Поединок/
 * Сетка/Правила-квиз/Бойцы) that used to live here moved to `/tournaments`
 * (see `app/tournaments/page.tsx`) — it explains how a real tournament run
 * plays out, which reads better next to the real tournament list than on the
 * landing page.
 *
 * СНАРЯЖЕНИЕ (`Equipment`, real bout-rules data — the four lot-drawn weapon
 * categories) and АРХИВ ЭКИПИРОВКИ (`GearArchive`, the nine-item опись a
 * fighter wears regardless of category) sit next to each other on purpose —
 * two different опись, "чем бьются" then "во что одет", not one merged into
 * the other.
 *
 * The previous `DirectoryIndex` (real-route ToC) is no longer rendered here:
 * with the remaining detailed sections plus the anchor `SectionIndex`, a
 * second "here are five more pages" block read as redundant, and all routes
 * stay one click away via the header nav. The component itself is left
 * untouched in `features/home/directory-index.tsx` rather than deleted.
 */
```

- [ ] **Step 3: Add the 5 imports to `frontend/src/app/tournaments/page.tsx`**

Find:
```tsx
import { TournamentGrid } from "@/features/home/tournament-grid";
import { DirectionalTransition } from "@/features/transitions/directional-transition";
import { WeaponDrawBillet } from "@/features/tournaments/weapon-draw-billet";
```

Replace with:
```tsx
import { TournamentGrid } from "@/features/home/tournament-grid";
import { DirectionalTransition } from "@/features/transitions/directional-transition";
import { BracketGrid } from "@/features/tournaments/tournament-path/bracket-grid";
import { Dossiers } from "@/features/tournaments/tournament-path/dossiers";
import { Poedinok } from "@/features/tournaments/tournament-path/poedinok";
import { RulesQuiz } from "@/features/tournaments/tournament-path/rules-quiz";
import { TournamentPathProvider } from "@/features/tournaments/tournament-path/tournament-path-context";
import { WeaponDrawBillet } from "@/features/tournaments/weapon-draw-billet";
```

- [ ] **Step 4: Render the demo block below the real tournament list in `frontend/src/app/tournaments/page.tsx`**

Find (the end of the component's return statement):
```tsx
        <WeaponDrawBillet />
      </Container>
    </DirectionalTransition>
  );
}
```

Replace with:
```tsx
        <WeaponDrawBillet />
      </Container>

      {/* Interactive walkthrough of one fighter's run through a bracket —
          lives here, not on the landing page, so it sits next to the real
          tournament list it explains. Rendered outside `Container` on
          purpose: these four sections lay themselves out full-bleed
          (own `mx-auto max-w-[88rem]` wrappers), the same way they did on
          the homepage before this moved. Поединок/Сетка/Правила-квиз/Бойцы
          share one `TournamentPathProvider` — the "заявленный разряд" state
          and the fixed demo bracket must stay one source of truth across
          all four. */}
      <TournamentPathProvider>
        <Poedinok />
        <BracketGrid />
        <RulesQuiz />
        <Dossiers />
      </TournamentPathProvider>
    </DirectionalTransition>
  );
}
```

- [ ] **Step 5: Fix `Poedinok`'s now-circular link in `frontend/src/features/tournaments/tournament-path/poedinok.tsx`**

This paragraph used to link to `/tournaments` from the homepage; now the component renders ON `/tournaments`, so the link would point at the page it's already on.

Find:
```tsx
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-3)]">
          Это демонстрация одного пути по турнирной сетке, не настоящий поединок. Настоящий жребий
          бросается в карточке боя судьёй и сразу пишется сервером в журнал — см.{" "}
          <Link href="/tournaments" className="underline decoration-[var(--border-strong)] hover:text-[var(--accent)]">
            страницу турниров
          </Link>
          .
        </p>
```

Replace with:
```tsx
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-3)]">
          Это демонстрация одного пути по турнирной сетке, не настоящий поединок. Настоящий жребий
          бросается в карточке боя судьёй и сразу пишется сервером в журнал — см. список турниров
          выше.
        </p>
```

Then remove the now-unused import at the top of the same file:

Find:
```tsx
"use client";

import Link from "next/link";

import { Badge } from "@/components/ui";
```

Replace with:
```tsx
"use client";

import { Badge } from "@/components/ui";
```

- [ ] **Step 6: Verify it compiles clean**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && npm run lint`
Expected: no errors (confirms the removed `Link` import isn't flagged as unused-but-still-present, and nothing else broke).

- [ ] **Step 7: Visual check — content moved correctly**

Run: `cd frontend && npm run dev`.

Check `http://localhost:3000/`:
- Expected: homepage now ends its interactive content at Стенка/Круг, then goes straight to Снаряжение (Equipment) — no Поединок/Сетка/Правила/Бойцы anywhere on the page.

Check `http://localhost:3000/tournaments`:
- Expected: real tournament list renders first (unchanged), then below it the demo block appears — pick a fighter in "Поединок", confirm the bracket in "Сетка" reacts, answer a question in "Правила", confirm "Бойцы" dossiers render. Confirm the "см. список турниров выше" paragraph reads correctly with no dangling link.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(frontend): move tournament walkthrough demo to /tournaments

Поединок/Сетка/Правила-квиз/Бойцы now render on the real tournaments
page, below the real tournament list, instead of on the homepage —
they explain how a tournament run plays out, which belongs next to
the real list rather than on the landing page.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Link `RulesQuiz` to the real regulations page

The quiz's 4 questions are already confirmed against the real ruleset (see the file's own header comment), but the quiz itself isn't the authoritative document — `/rules` is. Add a way out to it.

**Files:**
- Modify: `frontend/src/features/tournaments/tournament-path/rules-quiz.tsx`

**Interfaces:**
- Consumes: none new.
- Produces: no exported signature change — `RulesQuiz` still takes no props.

- [ ] **Step 1: Add the `Link` import**

Find:
```tsx
"use client";

import { useState } from "react";
```

Replace with:
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
```

- [ ] **Step 2: Add the link at the end of the score sidebar**

Find:
```tsx
            <p className="mt-6 text-[0.8125rem] leading-relaxed text-[var(--text-4)]">
              Судейская аттестация идёт по той же логике, но по полной редакции правил и с разбором видео.
            </p>
          </aside>
```

Replace with:
```tsx
            <p className="mt-6 text-[0.8125rem] leading-relaxed text-[var(--text-4)]">
              Судейская аттестация идёт по той же логике, но по полной редакции правил и с разбором видео.
            </p>
            <Link
              href="/rules"
              className="record-label mt-4 inline-block text-[var(--accent)] hover:underline"
            >
              Полный регламент →
            </Link>
          </aside>
```

- [ ] **Step 3: Verify it compiles clean**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Visual check**

Run: `cd frontend && npm run dev`, open `http://localhost:3000/tournaments`, scroll to "Что по правилам?".
Expected: a gold "Полный регламент →" link sits under the score sidebar's explanatory paragraph, styled like the homepage's other accent-colored text links; clicking it navigates to `/rules`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(frontend): link the rules quiz to the real regulations page

RulesQuiz's questions are already sourced from the confirmed real
ruleset, but /rules stays the single authoritative document — the
quiz now points there instead of the two silently drifting apart.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Remove the now-dead anchors from the homepage's `SectionIndex`

`SectionIndex` (the homepage's bottom anchor table-of-contents) still lists 4 entries — Поединок, Сетка, Правила, Бойцы — whose target sections no longer exist on the homepage after Task 2. Left as-is, those 4 rows would link to nothing. Full removal of `SectionIndex` itself is Stage 3 (once Снаряжение/Архив also move away and only 2 entries would remain) — this task only drops the entries that are already gone.

**Files:**
- Modify: `frontend/src/features/home/section-index.tsx`

**Interfaces:**
- Produces: `SectionIndex` still takes no props, same as before — only its rendered list shrinks from 8 to 4 entries.

- [ ] **Step 1: Update the file's doc comment**

Find:
```tsx
/**
 * Homepage anchor index (README section 11) — a sibling to
 * `directory-index.tsx`, not a replacement: that one links to real routes
 * (/tournaments, /rules, …), this one links to in-page anchors built across
 * this section and two others (СЕТКА/ПОЕДИНОК in `tournament-path/`,
 * СНАРЯЖЕНИЕ in `equipment.tsx`, ПРАВИЛА/БОЙЦЫ elsewhere) landing on this
 * same page. Deliberately a different shape: numbered ruled rows that step
 * via `padding-left` on hover, not `directory-index.tsx`'s arrow-translate —
 * two indexes that read as two different documents, not one component reused
 * with new copy. АРХИВ (`#arhiv-ekipirovki`, `gear-archive.tsx`) added
 * alongside СНАРЯЖЕНИЕ — pushed every later index down by one.
 */
```

Replace with:
```tsx
/**
 * Homepage anchor index (README section 11) — a sibling to
 * `directory-index.tsx`, not a replacement: that one links to real routes
 * (/tournaments, /rules, …), this one links to in-page anchors built across
 * this section and one other (СНАРЯЖЕНИЕ in `equipment.tsx`, АРХИВ in
 * `gear-archive.tsx`) landing on this same page. Deliberately a different
 * shape: numbered ruled rows that step via `padding-left` on hover, not
 * `directory-index.tsx`'s arrow-translate — two indexes that read as two
 * different documents, not one component reused with new copy.
 *
 * Поединок/Сетка/Правила/Бойцы used to anchor here too — they moved to
 * `/tournaments` (see `app/tournaments/page.tsx`) and are no longer listed.
 */
```

- [ ] **Step 2: Trim and renumber the `SECTIONS` array**

Find:
```tsx
const SECTIONS: { href: string; index: string; title: string; text: string }[] = [
  {
    href: "#poedinok",
    index: "01",
    title: "Поединок",
    text: "Прохождение турнира за одного бойца — жребий и до трёх сшибок в каждом круге.",
  },
  {
    href: "#setka",
    index: "02",
    title: "Сетка",
    text: "Карта состязания от первого круга до сходки, с текущим положением бойца.",
  },
  {
    href: "#snaryazhenie",
    index: "03",
    title: "Снаряжение",
    text: "Опись четырёх разрядов лота традиции — от безоружного боя до кистеня.",
  },
  {
    href: "#arhiv-ekipirovki",
    index: "04",
    title: "Архив",
    text: "Девять предметов обязательного комплекта, один за другим — от маски до шароваров.",
  },
  {
    href: "#pravila",
    index: "05",
    title: "Правила",
    text: "Регламент состязания — коротким квизом вместо страницы текста.",
  },
  {
    href: "#bojcy",
    index: "06",
    title: "Бойцы",
    text: "Личные дела участников: клуб, разряд, послужной список.",
  },
  {
    href: "#hronika",
    index: "07",
    title: "Хроника",
    text: "Документальные снимки состязаний прошлых лет.",
  },
  {
    href: "#zhivopis",
    index: "08",
    title: "Живопись",
    text: "Кулачный бой в живописи и архивной графике — от начала XIX века до наших дней.",
  },
];
```

Replace with:
```tsx
const SECTIONS: { href: string; index: string; title: string; text: string }[] = [
  {
    href: "#snaryazhenie",
    index: "01",
    title: "Снаряжение",
    text: "Опись четырёх разрядов лота традиции — от безоружного боя до кистеня.",
  },
  {
    href: "#arhiv-ekipirovki",
    index: "02",
    title: "Архив",
    text: "Девять предметов обязательного комплекта, один за другим — от маски до шароваров.",
  },
  {
    href: "#hronika",
    index: "03",
    title: "Хроника",
    text: "Документальные снимки состязаний прошлых лет.",
  },
  {
    href: "#zhivopis",
    index: "04",
    title: "Живопись",
    text: "Кулачный бой в живописи и архивной графике — от начала XIX века до наших дней.",
  },
];
```

- [ ] **Step 3: Verify it compiles clean**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 4: Visual check**

Run: `cd frontend && npm run dev`, open `http://localhost:3000/`, scroll to the bottom anchor index.
Expected: exactly 4 rows (01 Снаряжение, 02 Архив, 03 Хроника, 04 Живопись), each still scrolls to its section on click. No leftover rows for Поединок/Сетка/Правила/Бойцы.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(frontend): drop dead anchors from the homepage section index

Поединок/Сетка/Правила/Бойцы moved to /tournaments — their entries
in the homepage's anchor index pointed at sections that no longer
exist there. Full removal of the index itself is a later stage, once
equipment content also moves away.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
