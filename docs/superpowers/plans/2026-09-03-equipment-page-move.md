# Equipment Page Move (Stage 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Снаряжение (`Equipment`) and Архив экипировки (`GearArchive`) from the homepage to a new `/equipment` page, add "Снаряжение" to the header nav, and fix the Hero's same-page deep-link into the archive slider so it still works once the slider is on a different page.

**Architecture:** Same rename-then-move pattern Stage 1 used: `equipment.tsx`/`gear-archive.tsx` move to a new `features/equipment/` directory first (pure rename, zero behavior change), then their render moves from `app/page.tsx` to a new `app/equipment/page.tsx` with its own `getBoutRules()` fetch. Separately, the Hero's "опись" grid (`EquipmentPlate` in `hero-clash.tsx`) currently deep-links into the archive slider via a same-page `window` CustomEvent + `scrollIntoView` (`lib/gear-archive-link.ts`) — this breaks silently once the slider is on another page (no listener, no element to scroll to), so it's replaced with a cross-page `router.push("/equipment?exhibit=N")` plus a server-side `searchParams` read on the new page that seeds `GearArchive`'s initial slide index — no client-side `useSearchParams()`/Suspense needed.

**Tech Stack:** Next.js App Router (Server + Client Components), TypeScript, React 19, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-03-homepage-ia-restructure-design.md` (Этап 2 / Stage 2 — Stage 3, the final `SectionIndex`/directory cleanup, is already done ahead of schedule; see `docs/superpowers/plans/2026-09-03-tournaments-demo-block-move.md`'s follow-up commit. Nothing else from Stage 3 is in scope here).

## Global Constraints

- No backend changes — this plan touches only files under `frontend/src/`.
- `describeWeaponRule` (exported from `equipment.tsx`) must keep working exactly as today — it has no real cross-file importers currently (only comment mentions), so moving its file is safe, but its behavior/signature must not change.
- `EQUIPMENT_ITEMS`' data (`features/home/equipment-items.ts`) does not move — it's shared by the Hero (staying on the homepage) and `GearArchive` (moving to `/equipment`), so it belongs to neither page exclusively.
- Every task ends with `npx tsc --noEmit` passing (run from `frontend/`) before commit.
- No automated test suite exists in this frontend (no `test` script in `package.json`, no `*.test.*` files) — verification is `npx tsc --noEmit`, `npm run lint`, and manual dev-server checks.

---

### Task 1: Rename `equipment.tsx`/`gear-archive.tsx` into `features/equipment/`

Pure rename, zero behavior change — isolates file-move risk from the actual content move in Task 2.

**Files:**
- Move: `frontend/src/features/home/equipment.tsx` → `frontend/src/features/equipment/equipment.tsx`
- Move: `frontend/src/features/home/gear-archive.tsx` → `frontend/src/features/equipment/gear-archive.tsx`
- Modify: `frontend/src/app/page.tsx` (2 import lines)
- Modify: `frontend/src/features/home/hero-clash.tsx` (1 comment line)
- Modify: `frontend/src/components/brand/weapon-glyphs.tsx` (1 comment line)

**Interfaces:**
- Produces: `Equipment`, `describeWeaponRule` now resolve from `@/features/equipment/equipment`; `GearArchive` now resolves from `@/features/equipment/gear-archive`. No exported names change.

- [ ] **Step 1: Move both files with git so history is preserved**

```bash
cd frontend
git mv src/features/home/equipment.tsx src/features/equipment/equipment.tsx
git mv src/features/home/gear-archive.tsx src/features/equipment/gear-archive.tsx
```

- [ ] **Step 2: Update the 2 import paths in `frontend/src/app/page.tsx`**

Find:
```tsx
import { Equipment } from "@/features/home/equipment";
import { GearArchive } from "@/features/home/gear-archive";
```

Replace with:
```tsx
import { Equipment } from "@/features/equipment/equipment";
import { GearArchive } from "@/features/equipment/gear-archive";
```

- [ ] **Step 3: Update the stale path in the `hero-clash.tsx` comment**

In `frontend/src/features/home/hero-clash.tsx`, find (inside `EquipmentPlate`'s doc comment):
```
 * link into "Архив экипировки" (`gear-archive.tsx`) further down the page —
```

Replace with:
```
 * link into "Архив экипировки" (`features/equipment/gear-archive.tsx`) —
```

- [ ] **Step 4: Update the stale path in the `weapon-glyphs.tsx` comment**

In `frontend/src/components/brand/weapon-glyphs.tsx`, find (inside `description`'s doc comment above `WEAPON_MOTIFS`):
```
 * a competition rule (judges, staging, victory conditions stay backend-driven
 * via `describeWeaponRule` in `equipment.tsx`, further down the page). Wording
```

Replace with:
```
 * a competition rule (judges, staging, victory conditions stay backend-driven
 * via `describeWeaponRule` in `features/equipment/equipment.tsx`). Wording
```

- [ ] **Step 5: Verify the move compiles clean**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 6: Visual check — homepage unchanged**

Run: `cd frontend && npm run dev`, open `http://localhost:3000/`.
Expected: page looks pixel-identical to before this task — Снаряжение and Архив экипировки (Экспонаты) still render on the homepage, in the same place, fully interactive (archive slider still steps through exhibits with Назад/Следующий). This task only moved files, it did not move content yet.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(frontend): move equipment/gear-archive under features/equipment

Pure rename ahead of relocating these sections to /equipment — they no
longer belong under features/home/.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Move the render from the homepage to a new `/equipment` page

**Files:**
- Modify: `frontend/src/app/page.tsx` (remove `Equipment`/`GearArchive` imports, JSX, and update the doc comment)
- Create: `frontend/src/app/equipment/page.tsx`

**Interfaces:**
- Consumes: `Equipment`, `GearArchive` from `@/features/equipment/*` (Task 1's paths); `getBoutRules` from `@/api/tournaments` (already used by `page.tsx` today — same call, `() => Promise<WeaponRulesView | null>`).
- Produces: route `/equipment`, page title "Снаряжение".

- [ ] **Step 1: Remove `Equipment`/`GearArchive` and their imports from `frontend/src/app/page.tsx`**

Find:
```tsx
import { Equipment } from "@/features/equipment/equipment";
import { GearArchive } from "@/features/equipment/gear-archive";
```
(This is 2 of the file's import lines — delete both, do not delete any other import on the lines around them.)

Delete this JSX (between `<StenkaKrug />` and `<Chronicle />`):
```tsx
      <Equipment rules={boutRules} />
      <GearArchive />
```

- [ ] **Step 2: Drop the now-unused `boutRules` fetch from `HomePage`**

Find:
```tsx
export default async function HomePage() {
  const [tournaments, boutRules] = await Promise.all([listTournaments(), getBoutRules()]);
  const upcoming = tournaments
    .filter((tournament) => tournament.status !== "ARCHIVED")
    .slice(0, 3);
```

Replace with:
```tsx
export default async function HomePage() {
  const tournaments = await listTournaments();
  const upcoming = tournaments
    .filter((tournament) => tournament.status !== "ARCHIVED")
    .slice(0, 3);
```

Then remove the now-unused `getBoutRules` import:

Find:
```tsx
import { getBoutRules, listTournaments } from "@/api/tournaments";
```

Replace with:
```tsx
import { listTournaments } from "@/api/tournaments";
```

- [ ] **Step 3: Update `HomePage`'s doc comment in `frontend/src/app/page.tsx`**

Find:
```tsx
/**
 * Front page of the archive — the "Живой архив" v3 redesign
 * (design_handoff_mstinskaya). Masthead, the real live-tournament bulletin,
 * then БУЗА (design_handoff_buza_river — the tradition's origin story,
 * collapsed by default and opened only by the river-boat button in the
 * header; see `features/home/buza-context.tsx`), then the editorial sections
 * (СТЕНКА/КРУГ → СНАРЯЖЕНИЕ → АРХИВ ЭКИПИРОВКИ → ХРОНИКА → ЖИВОПИСЬ). The
 * interactive tournament walkthrough (Поединок/Сетка/Правила-квиз/Бойцы)
 * that used to live here moved to `/tournaments`
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
 * The previous `DirectoryIndex` (real-route ToC) is no longer rendered here —
 * all routes stay one click away via the header nav — and the component
 * itself is left untouched in `features/home/directory-index.tsx` rather
 * than deleted.
 *
 * `SectionIndex` (the in-page anchor ToC) is gone from here too, ahead of
 * the IA-restructure spec's own Stage 3: once Поединок/Сетка/Правила/Бойцы
 * moved to `/tournaments`, it sat below every section it listed — no longer
 * navigation, just a recap of what a reader had already scrolled past. Left
 * untouched in `features/home/section-index.tsx`, same as `DirectoryIndex`.
 */
```

Replace with:
```tsx
/**
 * Front page of the archive — the "Живой архив" v3 redesign
 * (design_handoff_mstinskaya). Masthead, the real live-tournament bulletin,
 * then БУЗА (design_handoff_buza_river — the tradition's origin story,
 * collapsed by default and opened only by the river-boat button in the
 * header; see `features/home/buza-context.tsx`), then the remaining
 * editorial sections (СТЕНКА/КРУГ → ХРОНИКА → ЖИВОПИСЬ).
 *
 * Two blocks that used to live here moved out to their own routes: the
 * interactive tournament walkthrough (Поединок/Сетка/Правила-квиз/Бойцы) to
 * `/tournaments` (see `app/tournaments/page.tsx`), and Снаряжение/Архив
 * экипировки to `/equipment` (see `app/equipment/page.tsx`) — both explain
 * or catalog something with its own dedicated page now, which reads better
 * there than on the landing page.
 *
 * The previous `DirectoryIndex` (real-route ToC) is no longer rendered here —
 * all routes stay one click away via the header nav — and the component
 * itself is left untouched in `features/home/directory-index.tsx` rather
 * than deleted. `SectionIndex` (the in-page anchor ToC) is gone the same
 * way, left untouched in `features/home/section-index.tsx`.
 */
```

- [ ] **Step 4: Create `frontend/src/app/equipment/page.tsx`**

Deliberately no `?exhibit=` deep-link handling yet — `GearArchive` doesn't accept an
`initialIndex` prop until Task 3, which changes `GearArchive`, this file, and the
Hero's click handler together as one self-contained fix. This step's version just
renders both sections plainly, so this task's diff fully type-checks on its own.

```tsx
import type { Metadata } from "next";

import { getBoutRules } from "@/api/tournaments";
import { Container, PageHeader } from "@/components/ui";
import { Equipment } from "@/features/equipment/equipment";
import { GearArchive } from "@/features/equipment/gear-archive";

export const metadata: Metadata = {
  title: "Снаряжение",
  description: "Опись разрядов лота традиции и обязательного комплекта экипировки.",
};

export default async function EquipmentPage() {
  const boutRules = await getBoutRules();

  return (
    <>
      <Container className="py-10">
        <PageHeader
          eyebrow="Экипировка"
          title="Снаряжение"
          description="Четыре разряда лота традиции и девять предметов обязательного комплекта, которые боец носит независимо от выбранного разряда."
        />
      </Container>

      <Equipment rules={boutRules} />
      <GearArchive />
    </>
  );
}
```

- [ ] **Step 5: Verify it compiles clean**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 6: Visual check**

Run: `cd frontend && npm run dev`. Open `http://localhost:3000/` — confirm Снаряжение
and Архив экипировки no longer appear there. Open `http://localhost:3000/equipment` —
confirm both sections render there instead, fully interactive (archive slider steps
through exhibits with Назад/Следующий, arrow keys, and swipe).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(frontend): move Снаряжение/Архив экипировки to /equipment

Equipment and GearArchive now render on a new /equipment route instead
of the homepage, each with its own dedicated page identity.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Fix the Hero's deep-link into the archive slider

**Files:**
- Modify: `frontend/src/features/equipment/gear-archive.tsx` (accept `initialIndex` prop, drop the dead window-event listener)
- Modify: `frontend/src/app/equipment/page.tsx` (read `?exhibit=N` server-side, pass it to `GearArchive`)
- Modify: `frontend/src/features/home/hero-clash.tsx` (`EquipmentPlate`'s click handler navigates cross-page instead of dispatching the old event)
- Delete: `frontend/src/lib/gear-archive-link.ts` (nothing uses it after this task)

**Interfaces:**
- Consumes: `GearArchive` from `@/features/equipment/gear-archive` (Task 2's import, unchanged path); `useRouter` from `next/navigation` (standard Next.js client hook, no new dependency).
- Produces: `GearArchive` now takes `{ initialIndex?: number }`.

- [ ] **Step 1: Make `GearArchive` accept an `initialIndex` prop and drop the dead event listener**

In `frontend/src/features/equipment/gear-archive.tsx`, find:
```tsx
import { Container, cn } from "@/components/ui";
import { EQUIPMENT_ITEMS } from "@/features/home/equipment-items";
import { GEAR_ARCHIVE_SELECT_EVENT } from "@/lib/gear-archive-link";
import { TURN_EASE } from "@/lib/motion";
```

Replace with:
```tsx
import { Container, cn } from "@/components/ui";
import { EQUIPMENT_ITEMS } from "@/features/home/equipment-items";
import { TURN_EASE } from "@/lib/motion";
```

Find:
```tsx
export function GearArchive() {
  const [index, setIndex] = useState(0);
```

Replace with:
```tsx
export function GearArchive({ initialIndex }: { initialIndex?: number } = {}) {
  const [index, setIndex] = useState(initialIndex ?? 0);
```

Find (the whole deep-link listener effect — this is the block that used to receive the same-page event; it has no sender left after Step 2 below, so it's dead code):
```tsx
  // Deep-link target: the hero's опись grid (`EquipmentPlate`) dispatches
  // this to jump straight to a specific exhibit — see `@/lib/gear-archive-
  // link`. `direction` picked from the jump distance so the slide still
  // animates toward where the target actually is, not always forward.
  useEffect(() => {
    function onSelect(event: Event) {
      const targetIndex = (event as CustomEvent<number>).detail;
      if (typeof targetIndex !== "number" || targetIndex === index) return;
      setDirection(targetIndex > index ? 1 : -1);
      setIndex(targetIndex);
    }
    window.addEventListener(GEAR_ARCHIVE_SELECT_EVENT, onSelect);
    return () => window.removeEventListener(GEAR_ARCHIVE_SELECT_EVENT, onSelect);
  }, [index]);

  function handleDragEnd(_event: unknown, info: PanInfo) {
```

Replace with:
```tsx
  function handleDragEnd(_event: unknown, info: PanInfo) {
```

Update the file's own doc comment to remove the now-inaccurate deep-link paragraph:

Find:
```tsx
 * No real photos exist yet for any of the 9 items (`image` is `undefined`
 * on every entry) — `ExhibitSwatch` (an honest "specimen not yet
 * illustrated" placeholder, not a guess at the object's actual shape) covers
 * every slide for now. Filling in an item's `image` path once a real file
 * lands at `public/references/exhibits/` is the only change needed to swap
 * that one slide over to the real photo — nothing else in this file changes.
 */
```

Replace with:
```tsx
 * No real photos exist yet for any of the 9 items (`image` is `undefined`
 * on every entry) — `ExhibitSwatch` (an honest "specimen not yet
 * illustrated" placeholder, not a guess at the object's actual shape) covers
 * every slide for now. Filling in an item's `image` path once a real file
 * lands at `public/references/exhibits/` is the only change needed to swap
 * that one slide over to the real photo — nothing else in this file changes.
 *
 * `initialIndex` seeds which slide shows first — the homepage Hero's "опись"
 * grid (`EquipmentPlate` in `features/home/hero-clash.tsx`) deep-links here
 * via `/equipment?exhibit=N`, and `app/equipment/page.tsx` reads that
 * search param server-side and passes it down. There is no same-page event
 * anymore (there used to be, back when this section lived on the homepage
 * next to the Hero) — the two are on different routes now.
 */
```

- [ ] **Step 2: Read `?exhibit=N` server-side in `frontend/src/app/equipment/page.tsx` and pass it to `GearArchive`**

Find:
```tsx
import type { Metadata } from "next";

import { getBoutRules } from "@/api/tournaments";
import { Container, PageHeader } from "@/components/ui";
import { Equipment } from "@/features/equipment/equipment";
import { GearArchive } from "@/features/equipment/gear-archive";

export const metadata: Metadata = {
  title: "Снаряжение",
  description: "Опись разрядов лота традиции и обязательного комплекта экипировки.",
};

export default async function EquipmentPage() {
  const boutRules = await getBoutRules();

  return (
    <>
      <Container className="py-10">
        <PageHeader
          eyebrow="Экипировка"
          title="Снаряжение"
          description="Четыре разряда лота традиции и девять предметов обязательного комплекта, которые боец носит независимо от выбранного разряда."
        />
      </Container>

      <Equipment rules={boutRules} />
      <GearArchive />
    </>
  );
}
```

Replace with:
```tsx
import type { Metadata } from "next";

import { getBoutRules } from "@/api/tournaments";
import { Container, PageHeader } from "@/components/ui";
import { Equipment } from "@/features/equipment/equipment";
import { GearArchive } from "@/features/equipment/gear-archive";
import { EQUIPMENT_ITEMS } from "@/features/home/equipment-items";

export const metadata: Metadata = {
  title: "Снаряжение",
  description: "Опись разрядов лота традиции и обязательного комплекта экипировки.",
};

/** `?exhibit=N` deep-links here from the homepage Hero's "опись" grid
 *  (`EquipmentPlate` in `features/home/hero-clash.tsx`) — read server-side
 *  and passed down as `GearArchive`'s initial slide index, rather than the
 *  client reading it via `useSearchParams()` (which would need a `Suspense`
 *  boundary to avoid a prerender build failure). Out-of-range or missing
 *  values fall back to `GearArchive`'s own default (slide 0). */
function parseExhibitIndex(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= EQUIPMENT_ITEMS.length) return undefined;
  return parsed;
}

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [boutRules, params] = await Promise.all([getBoutRules(), searchParams]);
  const initialExhibitIndex = parseExhibitIndex(params.exhibit);

  return (
    <>
      <Container className="py-10">
        <PageHeader
          eyebrow="Экипировка"
          title="Снаряжение"
          description="Четыре разряда лота традиции и девять предметов обязательного комплекта, которые боец носит независимо от выбранного разряда."
        />
      </Container>

      <Equipment rules={boutRules} />
      <GearArchive initialIndex={initialExhibitIndex} />
    </>
  );
}
```

- [ ] **Step 3: Point `EquipmentPlate`'s click handler at `/equipment` instead of the old same-page event**

In `frontend/src/features/home/hero-clash.tsx`, find:
```tsx
import { CLASH_RESULT_LINES, ClashCard } from "@/features/home/clash-card";
import { EQUIPMENT_ITEMS } from "@/features/home/equipment-items";
import { selectExhibit } from "@/lib/gear-archive-link";
```

Replace with:
```tsx
import { useRouter } from "next/navigation";

import { CLASH_RESULT_LINES, ClashCard } from "@/features/home/clash-card";
import { EQUIPMENT_ITEMS } from "@/features/home/equipment-items";
```

Find (the doc comment above `EquipmentPlate`):
```tsx
/**
 * "Опись обязательный комплект на бою" — a direct port of the design
 * canvas's "Вариант В — опись обязательного снаряжения" (direction 4): the
 * nine items a fighter wears regardless of drawn weapon category, in the
 * same bordered specimen-plate frame as `ClashCard`. Each item is a deep
 * link into "Архив экипировки" (`features/equipment/gear-archive.tsx`) —
 * clicking "Паховая защита" here scrolls there and selects that exact
 * exhibit — via `selectExhibit` (`@/lib/gear-archive-link`). This replaced
 * an earlier "click starts a random сшибка" behavior: with a specific item
 * named on the button, jumping to a same-named exhibit is a much more
 * legible response to the click than an unrelated random weapon duel.
 *
 * `EQUIPMENT_ITEMS` itself lives in `equipment-items.ts`, shared with that
 * same archive slider — this grid's item order is the slider's index order.
 */
function EquipmentPlate() {
  return (
```

Replace with:
```tsx
/**
 * "Опись обязательный комплект на бою" — a direct port of the design
 * canvas's "Вариант В — опись обязательного снаряжения" (direction 4): the
 * nine items a fighter wears regardless of drawn weapon category, in the
 * same bordered specimen-plate frame as `ClashCard`. Each item deep-links
 * into "Архив экипировки" on `/equipment` (`features/equipment/gear-
 * archive.tsx`) — clicking "Паховая защита" here navigates there with that
 * exact exhibit already selected, via `?exhibit=N` (read server-side by
 * `app/equipment/page.tsx`). This replaced an earlier "click starts a
 * random сшибка" behavior: with a specific item named on the button,
 * jumping to a same-named exhibit is a much more legible response to the
 * click than an unrelated random weapon duel.
 *
 * `EQUIPMENT_ITEMS` itself lives in `equipment-items.ts`, shared with that
 * same archive slider — this grid's item order is the slider's index order.
 */
function EquipmentPlate() {
  const router = useRouter();
  return (
```

Find:
```tsx
            onClick={() => selectExhibit(index)}
```

Replace with:
```tsx
            onClick={() => router.push(`/equipment?exhibit=${index}`)}
```

- [ ] **Step 4: Delete the now-unused `lib/gear-archive-link.ts`**

```bash
git rm frontend/src/lib/gear-archive-link.ts
```

- [ ] **Step 5: Verify it compiles clean**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 6: Visual check — deep-link works cross-page**

Run: `cd frontend && npm run dev`.

Check `http://localhost:3000/`:
- Expected: page no longer renders Снаряжение/Архив экипировки sections. In the Hero, toggle to the "опись" illustration mode (`HeroIllustrationToggle`, below the illustration plate) and click any of the 9 items in the grid (e.g. "Паховая защита").
- Expected: browser navigates to `/equipment?exhibit=<N>` where `N` matches the clicked item's position (0-indexed), and the archive slider ("Экспонаты") on that page opens directly on that exact item, not on item 1.

Check `http://localhost:3000/equipment` directly (no query string):
- Expected: page renders normally, archive slider starts at exhibit 1 (`initialIndex` undefined → default 0), Назад/Следующий/swipe/arrow-key navigation all still work.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(frontend): fix Hero's archive deep-link across the /equipment move

EquipmentPlate's click-to-jump into the archive slider used a same-page
window event + scrollIntoView, which silently broke once GearArchive
moved to /equipment (no listener, no element to scroll to). Now
navigates to /equipment?exhibit=N, read server-side and passed down as
GearArchive's initial slide index — no client useSearchParams()/
Suspense needed. Removes the now-dead event plumbing entirely.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add "Снаряжение" to the header nav

**Files:**
- Modify: `frontend/src/components/layout/site-header.tsx`

**Interfaces:**
- Produces: no exported signature change — `SiteHeader` still takes no props, `NAV` just grows by one entry.

- [ ] **Step 1: Add the nav entry and its weapon-motif assignment**

Find:
```tsx
const NAV = [
  { href: "/tournaments", label: "Турниры" },
  { href: "/athletes", label: "Спортсмены" },
  { href: "/clubs", label: "Клубы" },
  { href: "/rules", label: "Правила" },
  { href: "/education", label: "Обучение" },
];
```

Replace with:
```tsx
const NAV = [
  { href: "/tournaments", label: "Турниры" },
  { href: "/athletes", label: "Спортсмены" },
  { href: "/clubs", label: "Клубы" },
  { href: "/rules", label: "Правила" },
  { href: "/equipment", label: "Снаряжение" },
  { href: "/education", label: "Обучение" },
];
```

Find:
```tsx
const NAV_WEAPON: Record<string, WeaponMotifKey> = {
  "/tournaments": "kisten",
  "/athletes": "hands",
  "/clubs": "nozh",
  "/rules": "palka",
  "/education": "kisten",
};
```

Replace with:
```tsx
const NAV_WEAPON: Record<string, WeaponMotifKey> = {
  "/tournaments": "kisten",
  "/athletes": "hands",
  "/clubs": "nozh",
  "/rules": "palka",
  "/equipment": "hands",
  "/education": "kisten",
};
```

- [ ] **Step 2: Verify it compiles clean**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 3: Visual check**

Run: `cd frontend && npm run dev`, open `http://localhost:3000/`.
Expected: desktop header nav now reads Турниры · Спортсмены · Клубы · Правила · Снаряжение · Обучение (6 items, no layout overflow/wrapping). Clicking "Снаряжение" navigates to `/equipment` and shows it as the active item (oxblood underline). Open the mobile menu (narrow viewport or resize) and confirm "06 Снаряжение" appears as the 5th numbered row, between Правила and Обучение, with the same hover/entrance animation as the other rows.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(frontend): add Снаряжение to the header nav

/equipment existed with no way to reach it from the header — adds it
between Правила and Обучение, matching the spec's intended nav order.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
