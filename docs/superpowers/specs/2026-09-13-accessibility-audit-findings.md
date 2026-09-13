# Accessibility Audit Findings — WCAG 2.1 AA
**Date:** 2026-09-13
**Scope:** Mstina Platform frontend (`frontend/`) — dynamic axe-core + tab-order scan across 14 routes (Task 2), a live/static keyboard + reduced-motion pass over four named custom widgets (Task 3), and a static code review of shared UI primitives, header/footer landmarks, heading hierarchy sitewide, and `/rules/[id]` (Task 4, independently reviewed).

## Summary

**There are 0 critical findings in this audit.** Every axe-core violation recorded — and there is exactly one rule that ever fired, `color-contrast` — is **serious** impact: 26 nodes across 6 of the 14 scanned URLs, traceable to four design-token pairs, dominated by two (`--accent`/`--accent-strong`/`--accent-soft` on dark surfaces, 6 nodes; `--surface-paper-label` on `--surface-paper`, 18 nodes, all on `/tournaments`; `--text-4` on a dark surface, 1 node, `/tournaments`; `--gold` at 6% opacity, 1 node, `/equipment`), which is good news for remediation cost since fixing those four token pairs resolves all 26 node-level hits at once. Manual and static review surfaced no additional serious axe-style defects but did surface one strong, independently-confirmed **Level A** structural gap outside axe's reach — no skip-to-content link (WCAG 2.4.1) — plus one moderate ARIA pattern mismatch in the lot-dice widget, and four minor/best-practice notes. Zero moderate or minor findings came from axe-core itself; the moderate/minor tier here is entirely manual/static judgment calls, stated as such throughout. Counting axe rules and manual/static entries as one list each: **Serious — 2 entries (26 axe nodes + 1 manual); Moderate — 1 entry; Minor — 5 entries; Critical — 0.**

---

## Findings, ranked by severity

### Serious

#### Shared primitive

**`color-contrast` — accent-family tokens on dark/soft surfaces (axe rule id: `color-contrast`, impact: serious, 6 nodes)**
- **What:** Text or fill using `--accent` (`#b02a20`), `--accent-strong` (`#c15951`), or `--accent-soft` (`#331712`) against near-black or accent-soft backgrounds falls short of the required contrast ratio in four distinct usage directions: accent text on dark background (`/login`, `/register`: 2.84, needs 4.5), accent as button background with dark text on top (`/tournaments` primary CTA: 2.84, needs 4.5), accent-on-accent-soft chip (`/tournaments/new` wizard step indicator: 2.51, needs 4.5), accent-strong on accent-soft status badge (`/tournaments/[id]` "Идёт" badge: 3.78, needs 4.5), and the visible, non-decorative "01" numeral labeling the gear exhibit on `/equipment` (2.73, needs 3.0 for large text).
- **Where:** `/equipment` (1 node), `/login` (1), `/register` (1), `/tournaments` (1: primary CTA button), `/tournaments/new` (1), `/tournaments/[id]` (1).
- **Why it fails WCAG 2.1 AA:** 1.4.3 Contrast (Minimum), Level AA. Every instance is a CSS custom-property value problem, not a per-component bug — recurring across six independent routes and four distinct usage patterns (foreground, background, chip, badge) is the strongest signal in the whole audit that `--accent` itself needs to shift lighter/more saturated rather than patching each call site.
- **Tier rationale:** classified as shared primitive because the root cause lives in global design tokens (`globals.css` / Tailwind theme) — one token-value fix cascades to all 6 nodes across 6 routes, even though each node's markup sits in that route's own component.

**`color-contrast` — surface-paper label pair (axe rule id: `color-contrast`, impact: serious, 18 nodes)**
- **What:** `--surface-paper-label` (`#6b5c42`) text on `--surface-paper` (`#d6c7a7`) background — the light "paper" dossier-card theme — measures 3.89 against a 4.5 requirement. Repeated identically across all 3 visible fighter dossier cards on `/tournaments` (6 micro-label fields per card: "Личное дело", "Боёв", "Побед", "Круг", "Разряд", club/city line).
- **Where:** `/tournaments` only (18 of that page's 20 total color-contrast nodes).
- **Why it fails WCAG 2.1 AA:** 1.4.3 Contrast (Minimum), Level AA. Independent from the accent-family problem — a second, separate token pair with the same class of failure, confirming the contrast problem isn't isolated to one theme.
- **Tier rationale:** shared primitive — this is a reusable design-token pair (light "paper" surface theme) currently only instantiated on `/tournaments`'s dossier-card component, so a token fix belongs at the same level as the accent fix even though today's node count is concentrated on one route.

**`color-contrast` — `--text-4` on a dark surface (axe rule id: `color-contrast`, impact: serious, 1 node)**
- **What:** `--text-4` (`#8b7f6b`, `globals.css:46`) text on a dark `/tournaments` surface (`#241c15`) — the "Круг 1" round-status label — measures 4.27 against a 4.5 requirement, the smallest gap found in the whole audit.
- **Where:** `/tournaments` only (the round-status label; a separate node from the primary CTA button counted in the accent-family bucket above and from the 18 surface-paper-label nodes).
- **Why it fails WCAG 2.1 AA:** 1.4.3 Contrast (Minimum), Level AA. A third, distinct token from `--accent` and `--surface-paper-label` — an earlier draft of this report mis-bucketed this node into the accent-family group; corrected here.
- **Tier rationale:** shared primitive because `--text-4` is a global design token, even though only one node currently uses it in a failing combination.

**`color-contrast` — `--gold` at 6% opacity, decorative watermark (axe rule id: `color-contrast`, impact: serious, 1 node)**
- **What:** `--gold` (`#b07a35`, `globals.css:99`) at 6% opacity behind the `/equipment` gear card — the giant decorative "01" watermark — measures 1.06 against a 3.0 requirement for large text. This node is `aria-hidden="true"` and nearly invisible visually at 6% opacity, so its real-world impact is low even though axe still flags it as a technical AA failure — a materially different remediation situation than a normal visible-text contrast failure, and one that may warrant a different remedy (e.g. raising opacity) or a documented accept-risk rather than a token-wide `--gold` change.
- **Where:** `/equipment` only (the decorative watermark; distinct from the visible, non-decorative "01" numeral on the same page, which is genuinely `--accent` and counted in the accent-family bucket above).
- **Why it fails WCAG 2.1 AA:** 1.4.3 Contrast (Minimum), Level AA, technically — though see the real-world-impact caveat above. An earlier draft of this report mis-bucketed this node into the accent-family group; corrected here.
- **Tier rationale:** shared primitive because `--gold` is a global design token, even though only one node currently uses it in a failing combination.

#### Per-page

**`skip-to-content-link-missing`**
- **What:** No visually-hidden skip link exists before `<SiteHeader />` to let keyboard users bypass primary navigation and jump straight to `<main>`. Confirmed by grep (`skip-link|skip.?to.?content|Перейти к содержимому|SkipLink` — zero matches) and a direct read of `app/layout.tsx`, independently re-verified in the Task 4 review pass.
- **Where:** `frontend/src/app/layout.tsx` (site-wide — affects every route, since the header/nav is shared chrome).
- **Why it fails WCAG 2.1 AA:** 2.4.1 Bypass Blocks, Level A. This is technically a Level A (not AA) failure, but is included here as the single strongest, most concrete structural finding of the whole audit — it wasn't caught by axe-core (the header/nav/main landmark structure axe checks for is otherwise present and well-formed), only by static/manual review.
- **Severity call:** rated Serious by judgment (axe-core's own `bypass` rule is typically impact `serious`) — every keyboard user pays the tab-through-nav cost on every single page.
- **Tier rationale:** listed under "Per-page" mechanically because it lives in one file (`layout.tsx`), but in effect it is sitewide — flagging this explicitly since it doesn't cleanly fit either bucket: it's a single shared file whose fix, unlike the color tokens, is itself a shared-primitive-shaped change (one link, one place) that immediately benefits all routes. A future fix plan should treat it as a Phase 1 (shared primitive) item despite the mechanical per-file location.

### Moderate

#### Shared primitive

**`lot-dice-radiogroup-not-roving-tabindex`**
- **What:** The lot-throw method selector ("Онлайн" / "Живой кубик") uses `role="radiogroup"` / `role="radio"` on two plain `<button>` elements that are each individually Tab-stoppable. The WAI-ARIA APG radio-group pattern expects roving tabindex (only the checked radio is Tab-stoppable; arrow keys move selection between the rest). Functionally operable — both buttons reach Tab and activate via Enter/Space — but the announced role ("radio button, 1 of 2") sets an arrow-key-navigation expectation the widget doesn't fulfill.
- **Where:** `frontend/src/features/tournaments/lot-dice.tsx` (component `LotDice`), consumed from `bout-detail.tsx` — a widget instantiated per tournament bout, i.e. reused across every match's lot-draw step, not confined to one route.
- **Why it fails WCAG 2.1 AA:** 4.1.2 Name, Role, Value, Level A — the exposed role doesn't match the interaction model the role implies. Not a hard blocker (nothing is unreachable), so this is a pattern-correctness item rather than an operability failure.
- **Severity call:** Moderate, by judgment (the task's own source material called it "Minor/Moderate" — Moderate chosen since a screen-reader user's expectation is actively violated by the announced role, even though nothing is unusable).
- **Verification note:** this widget could only be verified statically (no live tournament fixture reached the lot-draw UI in the local dev DB) — see Known Gaps.

### Minor

#### Shared primitive

**`emptystate-title-not-a-heading`**
- **What:** The shared `EmptyState` component (`frontend/src/components/ui/index.tsx`, line 304) renders its title as a `<p>`, not a heading element.
- **Where:** `components/ui/index.tsx` — used wherever a route has no fixture data: `/clubs`, `/education`, `/rules` (currently empty), and would apply to `/tournaments`/`/equipment` if their lists were ever empty.
- **Why it fails WCAG 2.1 AA:** 1.3.1 Info and Relationships, Level A — only when `EmptyState` is the sole content of a route (no other heading present), a sighted-and-AT user loses a landmark-level heading to orient by. Confirmed context-dependent: every current usage sits under a page that already has its own `<h1>`/`<h2>` from `PageHeader`/`Section`, so this is a latent risk rather than an active failure today.
- **Severity call:** Minor/low priority, explicitly context-dependent per both the raw static findings and the independent review.

#### Per-page

**`toggle-swap-no-live-region`**
- **What:** The home-page mask ⇄ опись toggle (`HeroIllustrationToggle` in `hero-clash.tsx`) correctly updates its own button label on activation (accessible name states the next action), but the swapped illustration/опись content region itself isn't in an `aria-live` region, so a screen-reader user gets no proactive announcement that the displayed content changed beyond re-encountering the button's new label.
- **Where:** `frontend/src/features/home/hero-clash.tsx`, wired into `frontend/src/features/home/hero.tsx` — home page (`/`) only; not a multi-page widget.
- **Why it fails WCAG 2.1 AA:** closest fit is 4.1.3 Status Messages, Level AA, though this is a judgment call — the content swap is a direct result of the user's own action (not an out-of-band status update), so it's arguably outside 4.1.3's strict scope; flagged anyway since the practical effect (a content change with no announcement) is the same class of gap.
- **Severity call:** Minor — the toggle itself is fully keyboard-operable (both Enter and Space verified live) and has a clear, dynamic accessible name; this is a polish gap, not an operability defect.

**`weapon-toggle-title-only-label`**
- **What:** Icon-only weapon-class filter buttons on `/tournaments` (e.g. `title="Безоружный"`, `"Палка"`, `"Нож"`) rely solely on the `title` attribute for their accessible name — no `aria-label`, no visible text.
- **Where:** `/tournaments` page markup (dossier/roster filter controls).
- **Why it doesn't cleanly fail WCAG 2.1 AA:** passes axe-core's `button-name` rule (`title` is a valid accname source per spec), so this is **not** a formal SC failure — flagged as a real-world robustness gap: `title` isn't read by most mobile/touch screen readers, has inconsistent desktop AT support, and gives sighted keyboard users no visible label (only a slow native tooltip on hover, nothing on focus).
- **Severity call:** Minor, best-practice recommendation (add `aria-label`) rather than a WCAG violation.

**`focus-ring-weight-inconsistency`**
- **What:** The ruleset link on `/tournaments/[id]` uses `outline: solid 1px` where every other interactive control checked sitewide uses `solid 2px`.
- **Where:** `/tournaments/[id]` page.
- **Why it doesn't fail WCAG 2.1 AA:** 2.4.7 Focus Visible (AA) requires a visible indicator, not a minimum width — this control has one. Explicitly **not** a WCAG failure, included only as a design-consistency note.
- **Severity call:** Minor/cosmetic.

**`gear-slider-no-direct-jump-control`**
- **What:** The `/equipment` gear archive is a single-exhibit slider (intentional design — never shows all items at once) navigated only by "← НАЗАД" / "СЛЕДУЮЩИЙ →" buttons; there's no keyboard-reachable index/dot control to jump directly to a specific exhibit, so a keyboard user must page through every item sequentially.
- **Where:** `/equipment` (`GearArchive` component).
- **Why it doesn't fail WCAG 2.1 AA:** consistent with the slider's deliberate one-exhibit-at-a-time design; not a keyboard-trap or missing-control violation (both buttons are reachable and operable). Included as a UX observation, not a compliance gap.
- **Severity call:** Minor, optional UX improvement only.

---

## Corrections to this audit's own premise

The originating plan assumed two things that Task 3's investigation did not bear out:

1. **Reduced-motion was assumed to be an unhandled gap across all four named custom widgets.** In fact **3 of the 4** live widgets (lot-dice, monogram-flip, and the mask toggle's animated child `HelmetReveal`) already call `useReducedMotion()` from framer-motion and branch their animations accordingly, and the codebase additionally has a sitewide CSS `@media (prefers-reduced-motion: reduce)` catch-all in `globals.css` (~line 2635) that neutralizes plain-CSS animations/transitions everywhere else. Readers of this report should **not** treat reduced-motion as a live gap in this codebase — it was investigated thoroughly and found to be in good shape, with the two minor exceptions already listed above (which are ARIA/live-region issues, not motion issues).
2. **A fourth widget, a "global custom cursor," was assumed to exist and go unaudited.** It does not exist in the current codebase. This was confirmed exhaustively: grep across `frontend/src` (case-insensitive, broadened beyond the brief's original method) found only plain `cursor: pointer`/`cursor-not-allowed` CSS, a component-name search for `Cursor` returned zero matches, and `git log -S` across every local branch and remote for the path and identifiers named in prior-session memory (`features/cursor/custom-cursor.tsx`, `data-cursor-zone`) returned zero commits, ever. A doc comment in `helmet-reveal.tsx` independently corroborates that an earlier custom-cursor version of a related effect "was removed." Treat this as **widget out of scope / does not exist**, not as a missed check or a defect.

---

## Verified clean

Task 4's static code review actively checked the following and found no defects — recorded here so a future pass doesn't re-audit the same ground, and so the "0 critical findings" headline reads as backed by real coverage rather than just an absence of findings:

- **Heading hierarchy** — no heading-level defect anywhere sitewide (every route's `<h1>`/`<h2>`/`<h3>` nesting was traced and confirmed correct, including the corrected `tournament-card.tsx:39` citation for `/tournaments`).
- **Landmarks** — `<nav>` and `<main>` are well-formed and present on every route; this is also what let axe-core's own `bypass`-adjacent landmark checks pass everywhere except the skip-link gap noted above.
- **Form labeling** — form fields use real `<label for>` associations, not placeholder-only or `aria-label`-only labeling.
- **Status messaging** — the shared `Alert` component carries `role="alert"`/`aria-live` correctly.
- **Focus trap** — the mobile menu implements a working focus trap (focus can't escape to background content while it's open).
- **Document language** — `lang="ru"` is set correctly on the document root.

## Known gaps — what this audit could not reach live

- **`/rules/[id]`** — zero rule-set fixture rows in the local dev DB; reviewed statically only (file read of `frontend/src/app/rules/[id]/page.tsx`, heading structure and semantic markup confirmed correct by static trace, but never rendered in a browser during this audit).
- **`/tournaments/[id]/competitions/[competitionId]`** (the real competition/bracket/roster view) — only its generic "Запись не найдена" 500-error fallback was scanned. Root cause: `sqlalchemy.exc.OperationalError: no such column: competitions.category_id` against the local `dev.db`. This is traceable to a specific migration — `backend/migrations/versions/20260904_competition_eligibility.py` adds exactly that column — so `dev.db` is simply behind alembic head; a bounded, diagnosable environment issue rather than an open-ended unknown. (Caveat: that migration uses `postgresql.UUID`, so `alembic upgrade head` against this SQLite dev DB may not apply cleanly.) Unrelated to accessibility and out of scope to fix as part of this audit. No conclusions can be drawn about the real bracket/match-card/judge-result view's accessibility from this audit; it never rendered.
- **Lot-dice** (`lot-dice.tsx`) — the ARIA radiogroup/radio finding above is based on a static source read only; no live tournament in the local dev DB has a discipline/match reaching the "awaiting lot" state needed to render the widget in a browser (confirmed via the one live tournament, "Smoke Cup," which has zero disciplines configured). Confidence is high (full file read, native-element semantics confirmed) but this is not a live-browser-confirmed result the way the other two live-tested widgets are.
- **Empty-state-only routes** — `/clubs`, `/education`, and `/equipment`'s list view had zero fixture rows at scan time (`/equipment`'s gear archive itself is populated and was live-tested; it's the list-of-items empty-state path elsewhere that wasn't exercised), so only their empty-state UI was exercised, not a populated card grid/list.
- **`/tournaments`'s full tab order** — the page has substantially more focusable content (three roster pickers, a rules-quiz widget, icon toggles) than the 30-press ceiling anticipated; the walk was stopped per the task brief's own guidance rather than continuing indefinitely, so the tab sequence from press 31 onward (through to the footer) was not verified.
- **A populated `/profile`** — only tested against a freshly-registered throwaway account with no tournament history/achievements; a profile view with achievement lists or club membership was not available to test.

---

## Source material

- Task 2 (dynamic axe-core + tab order): `.superpowers/sdd/2026-09-13-accessibility-audit/task-2-report.md` (see "Fix round 1" for the corrected 26-node/6-URL figures used throughout this report) and the raw per-URL findings file referenced there.
- Task 3 (custom-widget keyboard/reduced-motion pass): `.superpowers/sdd/2026-09-13-accessibility-audit/task-3-report.md` and its raw findings file.
- Task 4 (static code review): `.superpowers/sdd/2026-09-13-accessibility-audit/task-4-report.md`, independently reviewed and corrected in `.superpowers/sdd/2026-09-13-accessibility-audit/task-4-review.md` (authoritative correction layer — e.g. `/tournaments`'s h3 is actually `frontend/src/features/tournaments/tournament-card.tsx:39`, not `tournaments/[id]/page.tsx:142` as the raw report states), and its raw findings file.

## Handoff

This report is the input for a future `writing-plans` pass to build the Phase 1 (shared-primitive fixes: the four color-token issues — `--accent`/`--accent-strong`/`--accent-soft`, `--surface-paper-label`/`--surface-paper`, `--text-4` on a dark surface, and `--gold` at 6% opacity (the last two dominated by, but separate from, the first two) — the skip-to-content link, the lot-dice ARIA pattern, the `EmptyState` heading) / Phase 2 (per-page polish: live-region on the hero toggle, `aria-label` on the weapon-class icon buttons, focus-ring consistency, gear-slider UX) fix plan. That plan is intentionally not part of this task, since its task list depends entirely on the findings above.

## Fix status

All findings above except `gear-slider-no-direct-jump-control` (explicitly
out of scope — the report itself calls it "not a compliance gap") have been
addressed:

- **Color-contrast (26 axe nodes, all four token pairs):** fixed by
  adjusting `--accent`, `--text-4`, and `--surface-paper-label` in
  `globals.css`; the `--gold` watermark's technical failure is a
  documented, zero-real-world-impact accepted risk (it is `aria-hidden`)
  rather than a token change, since reaching 3.0:1 would require ~72%
  opacity and defeat the decorative design.
- **`skip-to-content-link-missing`:** fixed — added to `app/layout.tsx`.
- **`lot-dice-radiogroup-not-roving-tabindex`:** fixed — roving tabindex +
  arrow-key navigation added; could not be live-browser-verified (same
  fixture-data limitation the original audit hit).
- **`emptystate-title-not-a-heading`:** fixed — `EmptyState` now renders an
  `<h2>` by default.
- **`toggle-swap-no-live-region`:** fixed — `HeroIllustration` wrapped in
  `aria-live="polite"`.
- **`weapon-toggle-title-only-label`:** fixed — `aria-label` added
  alongside the existing `title` on all three icon-only filter buttons.
- **`focus-ring-weight-inconsistency`:** already resolved by an unrelated redesign (the ruleset UI was rewritten after the original audit ran); verified during this fix pass — both interactive elements in `tournament-ruleset-picker.tsx` already use a 2px inset shadow matching the sitewide convention, so no change was needed.
