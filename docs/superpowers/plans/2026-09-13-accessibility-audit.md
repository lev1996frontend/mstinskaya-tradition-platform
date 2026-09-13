# Accessibility Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a single, ranked accessibility findings report covering all 14 frontend routes against WCAG 2.1 AA, combining a live-browser axe-core + keyboard-navigation pass with a static code review of shared primitives and custom widgets.

**Architecture:** No code changes in this plan — it is a pure investigation. A dynamic pass drives the already-running dev servers through the Playwright MCP tools (`mcp__playwright__browser_*`), injecting `axe-core` per route and walking tab order; a static pass reads `components/ui/*` and the named custom widgets for patterns axe cannot see (keyboard equivalents for pointer-only widgets, `prefers-reduced-motion` support). Both passes write raw notes to the executor's scratchpad; the final task merges them into one committed report.

**Tech Stack:** Next.js App Router frontend (already running on `localhost:3000`), FastAPI backend with local SQLite dev DB (`backend/dev.db`, no Docker/Postgres needed), Playwright MCP tools for the live browser, `axe-core` (loaded from `https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js`) injected into each page.

**Spec:** `docs/superpowers/specs/2026-09-13-accessibility-audit-design.md`

## Global Constraints

- Standard: WCAG 2.1 AA. Interface/chrome only — do not flag Russian data content (tournament/athlete/club names, rule text) as an accessibility bug just because it's untranslated; that's the i18n effort's scope, not this one.
- No backend or API changes. This plan only reads existing data; it must not mutate real domain rows other than the one disposable audit account created in Task 1.
- No automated enforcement added in this pass (no `eslint-plugin-jsx-a11y`, no axe-in-CI). Out of scope per the spec.
- Every route below must be checked: `/`, `/athletes`, `/athletes/[id]`, `/clubs`, `/education`, `/equipment`, `/login`, `/register`, `/profile`, `/rules`, `/rules/[id]`, `/tournaments`, `/tournaments/new`, `/tournaments/[id]`, `/tournaments/[id]/competitions/[competitionId]` (14 route templates + the nested detail = 15 URLs once IDs are filled in).
- Sample IDs (from the local dev DB, already seeded — do not create more domain rows to get IDs): athlete `3ae4b2f2f84747d59f54b339f7830dbc`, tournament `de5165f46c924c509d9b00613d5b4991`, competition `f2d28bd34b7147c698c8fef82d80ed9b` (belongs to that tournament). `clubs`, `courses` (education), `equipment_products`, and `rules` are empty in the dev DB — those routes get audited in their empty-list state only, and `/rules/[id]` is audited by static code read alone (no reachable row) — record this limitation in the findings report rather than inventing seed data for a historically-versioned table.

---

### Task 1: Bring up a testable environment and record fixtures

**Files:**
- Create: none (environment/data setup only)
- Test: manual `curl` verification, no automated test

**Interfaces:**
- Produces: a running backend on `http://localhost:8000`, a running frontend on `http://localhost:3000` (already running — verify, don't restart if healthy), and a bearer token for a disposable audit account, all of which Tasks 2 and 3 consume.

- [ ] **Step 1: Check whether the frontend dev server is already up**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000`
Expected: `200`. If not 200, start it: `cd frontend && npm run dev` (background), then re-check.

- [ ] **Step 2: Check whether the backend is up, start it if not**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/health`
If not `200`, start it in the background from `backend/`:

```bash
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

(`DATABASE_URL` in `backend/.env` already points at the local `sqlite+aiosqlite:///./dev.db` — no Postgres/Docker required.) Then re-run the `curl` from Step 2 until it returns `200`.

- [ ] **Step 3: Create a disposable audit account and capture its token**

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"accessibility.audit@example.com","password":"AuditPass123!","first_name":"Accessibility","last_name":"Audit"}'
```

Expected: `201` with a JSON body of shape `{"access_token": "...", "refresh_token": "..."}` (`TokenResponse` in `app/modules/auth/schemas/auth.py`) — registration and login are handled by `app/modules/auth/`, which wins route resolution per `CLAUDE.md`'s known-duplication note; do not use `app/modules/identity`'s shadowed routes. If the account already exists from a prior run, `POST /api/v1/auth/login` with the same credentials instead. Record the returned `access_token` — Task 2 needs it to reach `/profile` and `/tournaments/new` in their authenticated state.

- [ ] **Step 4: Confirm the sample fixture rows are still present**

```bash
backend/.venv/Scripts/python.exe -c "
import sqlite3
con = sqlite3.connect('backend/dev.db')
cur = con.cursor()
cur.execute('select id from athletes limit 1'); print('athlete', cur.fetchone())
cur.execute('select id from tournaments limit 1'); print('tournament', cur.fetchone())
cur.execute('select id from competitions limit 1'); print('competition', cur.fetchone())
"
```

Expected: the three IDs listed in Global Constraints. If any come back empty, note it in the findings report (Task 5) as "route untestable dynamically — no fixture data" instead of inserting new rows.

- [ ] **Step 5: No commit for this task** (environment setup only, nothing to check into git).

---

### Task 2: Dynamic pass — axe-core + tab order across all 15 URLs

**Files:**
- Create (in the executor's scratchpad, not the repo): `axe-findings.md` — one entry per URL with the raw axe-core violation list and tab-order notes.
- Test: the verification step below (confirm axe actually ran) stands in for a unit test, since this task produces investigative notes, not code.

**Interfaces:**
- Consumes: the bearer token and fixture IDs from Task 1.
- Produces: `axe-findings.md` in the scratchpad, one section per URL, each section containing the axe-core JSON violation array (or a summary of it) and a short tab-order note. Task 5 consumes this file.

- [ ] **Step 1: Establish the axe-core injection procedure and smoke-test it on `/`**

Using the Playwright MCP tools:
1. `mcp__playwright__browser_navigate` to `http://localhost:3000/`.
2. `mcp__playwright__browser_evaluate` with a function that injects a `<script src="https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js">` tag into the page, awaits its `load` event, then resolves — e.g.:

```js
() => new Promise((resolve, reject) => {
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
  s.onload = () => resolve('loaded');
  s.onerror = () => reject('failed to load axe-core');
  document.head.appendChild(s);
})
```

3. `mcp__playwright__browser_evaluate` again with `() => axe.run().then(r => JSON.stringify(r.violations))` and capture the returned JSON string.

Expected: step 3 returns a JSON array (possibly empty `[]`, which is a valid result — it means axe found nothing on that page, not that the injection failed). If `axe` is `undefined`, the injection failed — retry step 2 before proceeding.

- [ ] **Step 2: Verify the smoke test produced real output**

Confirm the JSON string from Step 1.3 parses as an array and, if non-empty, that each entry has an `id`, `impact`, and `nodes` field (axe-core's standard violation shape). Write this first result into `axe-findings.md` under a `## /` heading.

- [ ] **Step 3: Repeat the navigate → inject → run → record cycle for every remaining URL**

For each of the following, substitute the real path and, where the account must be authenticated (`/profile`, `/tournaments/new`), first set the captured token into `localStorage` via `browser_evaluate` — `() => localStorage.setItem('mstina.access_token', '<value>')` (the exact key from `frontend/src/lib/config.ts:10`, read by `frontend/src/features/auth/auth-context.tsx`) — and reload before injecting axe:

- `/athletes`
- `/athletes/3ae4b2f2f84747d59f54b339f7830dbc`
- `/clubs`
- `/education`
- `/equipment`
- `/login`
- `/register`
- `/profile` (authenticated)
- `/rules`
- `/tournaments`
- `/tournaments/new` (authenticated)
- `/tournaments/de5165f46c924c509d9b00613d5b4991`
- `/tournaments/de5165f46c924c509d9b00613d5b4991/competitions/f2d28bd34b7147c698c8fef82d80ed9b`

(`/rules/[id]` is skipped here — no fixture row exists; it's covered by Task 4's static read instead, per Global Constraints.)

Append each result to `axe-findings.md` under its own `## <path>` heading.

- [ ] **Step 4: Walk tab order on every URL just scanned**

For each URL, after the axe run: repeatedly call `mcp__playwright__browser_press_key` with `Tab`, taking a `mcp__playwright__browser_snapshot` after each press, until focus cycles back to the first element or 30 presses are reached (whichever comes first — 30 is a generous ceiling for these page sizes; if a page hits it without cycling, note that specifically rather than assuming a bug). Record in `axe-findings.md`, per URL:
- Whether every focused element is visually distinguishable as focused in the snapshot (look for a focus ring / outline in the accessible tree's bounding data, or note if you cannot tell from the snapshot alone and it needs a screenshot).
- Whether the order matches visual reading order (top-to-bottom, left-to-right for this LTR interface).
- Any element that should be reachable by keyboard (buttons, the custom cursor's target elements, cards that act as links) but is skipped.

- [ ] **Step 5: Verify completeness**

Confirm `axe-findings.md` has one `## <path>` section for all 13 URLs from Step 3 plus `/` from Step 1 (14 total — `/rules/[id]` intentionally excluded), each with both an axe result and a tab-order note. This file is not committed to git — it's Task 5's raw input.

---

### Task 3: Custom-widget keyboard/screen-reader pass + reduced-motion check

**Files:**
- Create (scratchpad): `widget-findings.md`
- Read: `frontend/src/features/tournaments/lot-dice.tsx`, `frontend/src/components/brand/monogram-flip.tsx`, the mask/опись toggle component (locate via `Grep` for `опись` or `mask` under `frontend/src/features/home/` — confirm the exact file before editing anything, per [[hero-redesign-exploration]] memory noting the mask is reused in the bracket demo too), and the custom-cursor component (`Grep` for `cursor` under `frontend/src/components/`).

**Interfaces:**
- Consumes: nothing from Task 2 (independent investigation).
- Produces: `widget-findings.md`, one section per widget, feeding Task 5.

- [ ] **Step 1: Locate the four named widgets precisely**

```bash
grep -rl "опись\|mask" frontend/src/features/home/
grep -rl "cursor" frontend/src/components/
```

Confirm the exact file paths for the mask/опись toggle and the custom cursor (the lot-dice and monogram-flip paths are already known from Task list above). Record the four confirmed paths at the top of `widget-findings.md`.

- [ ] **Step 2: For each widget, test keyboard-only operation live**

On the route where the widget appears (lot-dice → a tournament's active bout page if reachable, else static-only; monogram-flip → wherever it renders in the header/brand area; mask toggle → home page; custom cursor → any page, since it's likely global), use `mcp__playwright__browser_press_key` (`Tab`, `Enter`, `Space`) — never `browser_click` — to attempt every interaction the widget supports. Record per widget:
- Can it be reached via `Tab` at all?
- Can its primary action (flip, throw, toggle) be triggered without a pointer?
- Does `mcp__playwright__browser_snapshot` show an accessible name/role for it, or does it appear as an unlabeled generic element?

- [ ] **Step 3: For each widget, check the source for `prefers-reduced-motion` handling**

```bash
grep -n "prefers-reduced-motion\|useReducedMotion" frontend/src/features/tournaments/lot-dice.tsx frontend/src/components/brand/monogram-flip.tsx
```

(repeat for the mask toggle and custom cursor paths found in Step 1). Record a hit or a miss per file — a miss means the animation plays unconditionally, which is the expected finding per the spec's problem statement.

- [ ] **Step 4: Verify `widget-findings.md` covers all four widgets**

Confirm each of the four has a keyboard-operability verdict, an accessible-name verdict, and a reduced-motion verdict before moving on.

---

### Task 4: Static pass — shared primitives, heading hierarchy, `/rules/[id]`

**Files:**
- Create (scratchpad): `static-findings.md`
- Read: every file under `frontend/src/components/ui/`, `frontend/src/components/layout/site-header.tsx`, `frontend/src/components/layout/site-footer.tsx`, one representative page component per route family (already covered dynamically by Task 2, so this pass focuses on the component-level source, not re-deriving what axe already found), and `frontend/src/app/rules/[id]/page.tsx` for the one route Task 2 couldn't reach live.

**Interfaces:**
- Consumes: nothing from Tasks 2/3.
- Produces: `static-findings.md`, feeding Task 5.

- [ ] **Step 1: Read every file in `components/ui/` for missing accessible names and keyboard handling**

```bash
ls frontend/src/components/ui/
```

For each file (Button, Card, Field, Alert, and whatever else is listed), check: icon-only buttons have an `aria-label` or visually-hidden text; form fields (`Field` or equivalent) associate their label with the input via `htmlFor`/`id` or wrapping; anything with an `onClick` on a non-interactive element (`div`, `span`) also has `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler for `Enter`/`Space`. Record each finding (file, line, issue) in `static-findings.md`.

- [ ] **Step 2: Read `site-header.tsx` and `site-footer.tsx` for landmarks and skip links**

Check for: a `<nav>` (not a bare `<div>`) wrapping primary navigation, a `<main>` landmark somewhere in the layout the header/footer sit around (check `frontend/src/app/layout.tsx` if not in these two files), and whether a "skip to content" link exists before the header's visible content. Record findings.

- [ ] **Step 3: Check heading hierarchy per route**

```bash
grep -rn "<h1\|<h2\|<h3" frontend/src/app --include="page.tsx"
```

For each route, confirm exactly one `<h1>` and no level being skipped (an `<h3>` appearing with no `<h2>` above it on that page). Record any violation with the file and route.

- [ ] **Step 4: Static-read `/rules/[id]`**

Read `frontend/src/app/rules/[id]/page.tsx` directly (no live render possible — the dev DB has zero rows in `rules`). Apply the same checks as Step 1–3 by inspection: heading structure, any icon-only controls, keyboard handling for any interactive element. Record findings, explicitly labeled "static-only, unverified live" in `static-findings.md`.

- [ ] **Step 5: Verify `static-findings.md` covers all five areas**

Confirm the file has sections for: `components/ui/*`, header, footer, heading hierarchy (all routes), and `/rules/[id]`.

---

### Task 5: Compile and commit the findings report

**Files:**
- Create: `docs/superpowers/specs/2026-09-13-accessibility-audit-findings.md`

**Interfaces:**
- Consumes: `axe-findings.md`, `widget-findings.md`, and `static-findings.md` from the executor's scratchpad (Tasks 2–4).
- Produces: the committed findings report that a future `writing-plans` pass will read to build the Phase 1 / Phase 2 fix plan described in the spec's Output section.

- [ ] **Step 1: Aggregate and dedupe the axe-core violations**

Across all `## <path>` sections in `axe-findings.md`, group violations by their axe `id` (e.g. `color-contrast`, `button-name`) rather than listing the same rule once per page. For each distinct rule, list every path it fired on and its `impact` level.

- [ ] **Step 2: Merge in the manual and static findings**

Add the tab-order notes (Task 2 Step 4), the widget findings (Task 3), and the static findings (Task 4) as their own entries — they won't have an axe `id`, so give each a short slug (e.g. `lot-dice-not-keyboard-reachable`, `heading-skip-athletes-id`).

- [ ] **Step 3: Rank everything by severity and group by shared-primitive vs. per-page**

Use axe's four impact levels (critical/serious/moderate/minor) for axe-sourced findings; for manual/static findings, assign the closest equivalent by judgment and say so. Within each severity tier, split into "Shared primitive" (affects `components/ui/*`, header, footer, or a widget used on multiple pages) vs. "Per-page" (affects one route's own markup) — this split is what Phase 1 vs. Phase 2 of the future fix plan will consume directly, per the spec.

- [ ] **Step 4: Write the report**

Create `docs/superpowers/specs/2026-09-13-accessibility-audit-findings.md` with: a one-paragraph summary (total findings by severity), the ranked/grouped list from Step 3 (each entry: what, where, why it fails WCAG 2.1 AA, which success criterion), and a short "Known gaps" section listing the routes/data this audit could not reach live (`/rules/[id]`, and the empty-state-only routes: `/clubs`, `/education`, `/equipment`).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-13-accessibility-audit-findings.md
git commit -m "docs: accessibility audit findings (WCAG 2.1 AA)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Hand off**

Report to the user that the findings doc is committed and ready for a follow-up `writing-plans` pass to build the Phase 1 (shared primitives) / Phase 2 (per-feature) fix plan the spec describes — that plan is intentionally not part of this one, since its task list depends entirely on what this audit finds.
