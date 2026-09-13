# Accessibility Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every finding from the accessibility audit findings report — four failing color-contrast token pairs, a missing skip-to-content link, a lot-dice ARIA pattern mismatch, and four smaller per-page/shared-primitive gaps — without changing anything the audit found already compliant.

**Architecture:** Two phases matching the findings report's own grouping. Phase 1 (Tasks 1-7) touches shared primitives — CSS custom properties in `globals.css`, the root layout, and two shared components (`EmptyState`, `LotDice`) — so each fix cascades to every route that uses it. Phase 2 (Tasks 8-10) touches per-page markup that doesn't cascade. Color-token fixes are computed with the WCAG 2.1 relative-luminance formula (given verbatim below) rather than picked by eye, and verified live in a browser afterward since `color-mix()`-derived tokens (`--accent-strong`, `--accent-soft`) can't be hand-computed reliably.

**Tech Stack:** Next.js App Router frontend (`frontend/`), Tailwind v4 CSS custom properties in `frontend/src/app/globals.css`, Playwright MCP tools (`mcp__playwright__*`) for live verification against the dev server at `http://localhost:3000`.

**Spec:** `docs/superpowers/specs/2026-09-13-accessibility-audit-findings.md` (the findings report this plan fixes) and `docs/superpowers/specs/2026-09-13-accessibility-audit-design.md` (the original audit spec, for the WCAG 2.1 AA standard and interface-only scope it set).

## Global Constraints

- Standard: WCAG 2.1 AA. Every fix must reach the audit's stated target ratio for that finding — 4.5:1 for normal text, 3.0:1 for large text (≥18pt or ≥14pt bold), per 1.4.3 Contrast (Minimum).
- Interface/chrome only, per the original spec's data/interface boundary — none of these fixes touch content entered by real users (tournament names, athlete names, rule text).
- No backend or API changes.
- Do not touch anything the audit's "Verified clean" section covers (heading hierarchy, landmarks, form labeling, `Alert`'s `role="alert"`, the mobile-menu focus trap, `lang="ru"`) — those are already correct; changing them is out of scope and risks regressing a passing check.
- The `gear-slider-no-direct-jump-control` finding (Minor, explicitly "not a compliance gap... optional UX improvement only" per the findings report) is **excluded from this plan** — it's the one finding the report itself doesn't ask to be fixed.
- WCAG relative luminance formula (use exactly this — it is what the audit's own contrast numbers were computed with, confirmed by reproducing the report's 2.84, 4.27, and 3.89 figures during this plan's authoring):

```js
function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function relativeLuminance(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1), l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
```

- Current token values (from `frontend/src/app/globals.css`), for reference across tasks: `--background: #14120f` (line 39), `--surface: #241c15` (line 41), `--accent: #b02a20` (line 95), `--accent-strong: color-mix(in srgb, var(--accent) 78%, white)` (line 96), `--accent-soft: color-mix(in srgb, var(--accent) 20%, var(--background) 80%)` (line 97), `--gold: #b07a35` (line 99), `--text-4: #8b7f6b` (line 46), `--surface-paper: #d6c7a7` (line 51), `--surface-paper-label: #6b5c42` (line 53).

---

### Task 1: Fix `--accent` family contrast (shared primitive)

**Files:**
- Modify: `frontend/src/app/globals.css:95` (`--accent` value only — `--accent-strong`/`--accent-soft`/`--accent-deep` stay as their existing `color-mix()`/literal expressions, since `--accent-strong` and `--accent-soft` are defined *in terms of* `--accent` and will shift automatically)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: a new `--accent` value later tasks don't depend on (Tasks 2-4 touch different tokens).

- [ ] **Step 1: Reproduce the audit's reported failures**

Using the Global Constraints formula, confirm the current failures before touching anything:

```js
contrastRatio('#b02a20', '#14120f')  // accent text on --background (login/register) — expect ≈2.85, audit reported 2.84
contrastRatio('#b02a20', '#241c15')  // accent text/CTA-button-fill on --surface — expect ≈2.55
```

Both must be below 4.5 (confirms you're looking at the right failure before fixing it).

- [ ] **Step 2: Compute a hue-preserved replacement**

`--accent`'s current HSL is `H=4.2° S=69.2% L=40.8%` (from `#b02a20`). Write a small script (Node or Python, your choice — no project dependency needed, this is a one-off computation) that converts hex→HSL, holds H and S fixed, and increases L in 0.2% steps until BOTH of these hold simultaneously:

```js
contrastRatio(candidateHex, '#14120f') >= 4.5   // vs --background
contrastRatio(candidateHex, '#241c15') >= 4.5   // vs --surface
```

This plan's authoring already ran this search and found `L=59.0%` → **`#df584e`** satisfies both (4.5:1 to 5.02:1 vs background, 4.51:1 vs surface) — use this as your starting value, but re-derive it yourself with the script rather than trusting this number blind, since it's the value the rest of this task's live verification depends on. If your independent search lands on a different hex, use yours (rounding/step-size differences are fine) as long as it passes Step 1's two checks and Step 3's live checks below.

- [ ] **Step 3: Apply the change**

```css
--accent: #df584e; /* was #b02a20 — lightened (hue-preserved) to clear 4.5:1
                       against both --background and --surface; see
                       docs/superpowers/specs/2026-09-13-accessibility-audit-findings.md
                       "color-contrast — accent-family tokens" */
```

Edit `frontend/src/app/globals.css:95` to this value (using your Step 2 hex if it differs from `#df584e`).

- [ ] **Step 4: Live-verify all 6 reported failure sites, including the two `color-mix()`-derived ones this task can't hand-compute**

Start the frontend dev server if not already running (`cd frontend && npm run dev`, check `curl http://localhost:3000` first). Using the Playwright MCP tools (`mcp__playwright__browser_navigate`, `mcp__playwright__browser_evaluate` — load their schemas via ToolSearch `select:mcp__playwright__browser_navigate,mcp__playwright__browser_evaluate` if they show as deferred), for each of these 6 routes/elements, use `getComputedStyle` in the page to read the actual rendered `color`/`background-color` (this resolves `color-mix()` to a real color the browser computed, which you cannot get from hand math) and run `contrastRatio` on the resolved values:

1. `/login` — the accent-colored text element (link or label using `text-[var(--accent)]`).
2. `/register` — same pattern.
3. `/tournaments` — the primary CTA button (accent as background-color, with its foreground text color).
4. `/tournaments/new` — the wizard step indicator chip (`--accent` on `--accent-soft`).
5. `/tournaments/[id]` (use tournament id `de5165f46c924c509d9b00613d5b4991` from the original audit's fixtures, or any tournament with a status badge) — the "Идёт" status badge (`--accent-strong` on `--accent-soft`).
6. `/equipment` — the visible "01" numeral (large text, needs only 3.0:1, not 4.5:1 — this is the one site with a lower bar).

Record each site's resolved colors and computed ratio. If any of the two `color-mix()`-derived sites (4 or 5) still falls short of 4.5:1 even though `--accent` alone now passes, that means `--accent-soft`'s 20%-mix or `--accent-strong`'s 78%-mix dilutes too much — adjust the mix *percentage* in that token's `color-mix()` expression (not `--accent` itself, which is already fixed) until it passes, and re-verify.

- [ ] **Step 5: Confirm nothing else broke**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

Both must be clean (a CSS custom-property value change can't itself cause a `tsc`/`lint` failure, but this confirms you didn't accidentally touch a `.tsx` file while investigating).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "fix(a11y): lighten --accent to meet WCAG AA contrast (4.5:1)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Fix `--surface-paper-label` and `--text-4` contrast (shared primitive)

**Files:**
- Modify: `frontend/src/app/globals.css:46` (`--text-4`), `frontend/src/app/globals.css:53` (`--surface-paper-label`)

**Interfaces:**
- Consumes: nothing from Task 1 (different tokens, no shared dependency).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Reproduce the audit's reported failures**

```js
contrastRatio('#6b5c42', '#d6c7a7')  // --surface-paper-label on --surface-paper — expect ≈3.89, audit reported 3.89
contrastRatio('#8b7f6b', '#241c15')  // --text-4 on --surface — expect ≈4.27, audit reported 4.27 (smallest gap in the whole audit)
```

- [ ] **Step 2: Compute replacements**

Both of these are small gaps needing only a tiny shift — unlike Task 1's `--accent`, these should barely be perceptible:

- `--surface-paper-label` is dark text on a *light* paper background, so it needs to go **darker** (lower L), not lighter. Its current HSL is `H=38.0° S=23.7% L=33.9%`. This plan's authoring found `L=30.3%` → **`#60523b`** gives 4.55:1. Re-derive with your own script (same method as Task 1 Step 2, but searching L downward instead of upward) rather than trusting this number blind.
- `--text-4` is light text on a *dark* surface, so it needs to go **lighter** (higher L). Its current HSL is `H=37.5° S=13.0% L=48.2%`. This plan's authoring found `L=49.6%` → **`#8f836e`** gives exactly 4.50:1. Re-derive independently.

- [ ] **Step 3: Apply both changes**

```css
--text-4: #8f836e; /* was #8b7f6b — lightened fractionally (L 48.2%→49.6%) to
                       clear 4.5:1 against --surface; see findings report
                       "color-contrast — --text-4 on a dark surface" */
```

Edit line 46. Then:

```css
--surface-paper-label: #60523b; /* was #6b5c42 — darkened fractionally
                                    (L 33.9%→30.3%) to clear 4.5:1 against
                                    --surface-paper; see findings report
                                    "color-contrast — surface-paper label pair" */
```

Edit line 53.

- [ ] **Step 4: Verify with the formula directly (no browser needed — neither token involves `color-mix()`)**

Re-run `contrastRatio()` on your two new hex values against their respective backgrounds; confirm both are ≥4.5. Optionally spot-check live on `/tournaments` (the 3 dossier cards use `--surface-paper-label`) and the "Круг 1" label (uses `--text-4`) to confirm the visual shift is as subtle as expected.

- [ ] **Step 5: Confirm nothing broke**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "fix(a11y): adjust --text-4 and --surface-paper-label to meet WCAG AA contrast

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Document the `--gold` watermark as an accepted, AT-invisible risk (shared primitive)

**Files:**
- Modify: the component rendering the `/equipment` decorative "01" watermark — locate it first (see Step 1), do not assume a path.

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Locate the watermark and confirm it is genuinely `aria-hidden`**

```bash
grep -rn "aria-hidden" frontend/src/features/equipment/
```

Find the element rendering the large decorative "01" numeral behind the gear card (findings report: `--gold` at 6% opacity, `globals.css:99`, contrast 1.06 against a 3.0 requirement). Confirm it carries `aria-hidden="true"`.

- [ ] **Step 2: Confirm a real fix would destroy the design, not just tweak it**

Using the same formula as Task 1/2, confirm that reaching 3.0:1 for this element would require raising its opacity from 6% to roughly 72% (this plan's authoring computed this via alpha-blend against `--surface`) — i.e., turning a near-invisible watermark into a solid, dominant graphic element, not a subtle contrast nudge. If your own check confirms a similarly large opacity jump is required, proceed to Step 3 (document, don't change opacity). If you find the actual gap is much smaller than this, do the equivalent of Task 1 Step 2/3 instead — lighten the color and/or bump opacity to the real minimum needed for 3.0:1, and skip Step 3 below.

- [ ] **Step 3: Add a code comment documenting the accepted risk**

Immediately above the element's `aria-hidden="true"` attribute (or in a comment block just above the component, whichever reads more naturally in that file), add:

```tsx
{/* This decorative watermark is `aria-hidden` (never reached by screen
    readers) and rendered at 6% opacity by design — reaching WCAG 2.1
    AA's 3.0:1 large-text contrast threshold here would require ~72%
    opacity, which would turn a subtle background mark into a dominant
    graphic element and defeat its purpose. Accepted as a documented,
    zero-real-world-impact technical AA gap rather than "fixed" by
    destroying the design — see
    docs/superpowers/specs/2026-09-13-accessibility-audit-findings.md,
    "color-contrast — --gold at 6% opacity, decorative watermark". */}
```

- [ ] **Step 4: Confirm nothing broke**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/equipment/
git commit -m "docs(a11y): document the aria-hidden gold watermark as an accepted contrast risk

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Add a skip-to-content link (shared primitive)

**Files:**
- Modify: `frontend/src/app/layout.tsx` (currently renders `<SmoothScrollMount />`, `<AuthProvider><BuzaProvider><RiverSpine /><SiteHeader /><main className="flex-1">{children}</main>...` starting around line 60)
- Modify: `frontend/src/app/globals.css` (add a visually-hidden-until-focused utility if one doesn't already exist — check first)

**Interfaces:**
- Consumes: nothing from Tasks 1-3.
- Produces: a `#main-content` id on the `<main>` element that any later task could reference (none currently need to).

- [ ] **Step 1: Check for an existing visually-hidden-until-focused pattern**

```bash
grep -n "sr-only\|visually-hidden\|\.skip-link" frontend/src/app/globals.css
```

Tailwind v4 ships `sr-only` and (on focus) `focus:not-sr-only` utility classes by default — confirm these resolve in this project (check `frontend/src/app/globals.css`'s `@import "tailwindcss"` or equivalent, or just trust Tailwind v4's default utility set, which includes both). If a custom `.skip-link` class already exists from unrelated work, reuse it instead of introducing a second mechanism.

- [ ] **Step 2: Add the link and the `id` it targets**

In `frontend/src/app/layout.tsx`, add a skip link as the very first child inside `<body>`, before `<SmoothScrollMount />`:

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[var(--radius-sm)] focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-[var(--background)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent-strong)]"
>
  Перейти к содержимому
</a>
```

Then add `id="main-content"` to the existing `<main className="flex-1">{children}</main>` element:

```tsx
<main id="main-content" className="flex-1">{children}</main>
```

(Colors reference `--accent`/`--accent-strong`/`--background` — these are the values Task 1 may have already changed; if Task 1 runs before this task, use whatever the current token values are, no separate lookup needed since these are CSS custom properties, not hardcoded hex.)

- [ ] **Step 3: Verify live — tab order and visibility**

Using the Playwright MCP tools, navigate to `/`, press `Tab` once (`mcp__playwright__browser_press_key` with `Tab`), and take a snapshot (`mcp__playwright__browser_snapshot`). Confirm:
- The skip link is the first focusable element (appears in the snapshot's focused-element data before the header nav).
- It is visually hidden in its resting state (the `sr-only` class) but becomes visible on focus (check the snapshot's bounding box is non-zero once focused, or take a screenshot with `mcp__playwright__browser_take_screenshot` if the snapshot's accessibility tree alone doesn't confirm visibility).
- Pressing `Enter` while it's focused moves focus/scroll to `#main-content` (check `document.activeElement` or scroll position via `browser_evaluate` after the Enter press — a plain in-page anchor moves focus to the target if it's focusable, or at minimum scrolls it into view; if `<main>` isn't natively focusable, add `tabIndex={-1}` to the `<main id="main-content">` element so `href="#main-content"` actually moves keyboard focus there, not just scroll position).

- [ ] **Step 4: Confirm nothing broke**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/layout.tsx
git commit -m "feat(a11y): add a skip-to-content link (WCAG 2.4.1 Bypass Blocks)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Fix lot-dice's ARIA radiogroup to use roving tabindex (shared primitive)

**Files:**
- Modify: `frontend/src/features/tournaments/lot-dice.tsx:253-277` (the `role="radiogroup"` / `role="radio"` block)

**Interfaces:**
- Consumes: nothing from Tasks 1-4.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Read the current implementation**

Read `frontend/src/features/tournaments/lot-dice.tsx:250-280` in full (already excerpted in the findings report, but read the live file — line numbers may have shifted since the audit). Confirm the structure: a `<div role="radiogroup" aria-label="Способ жеребьёвки">` wrapping two `motion.button` elements, each `role="radio"` `aria-checked={active}`, each individually reachable by `Tab` (no `tabIndex` management today), selection via `onClick`.

- [ ] **Step 2: Implement roving tabindex + arrow-key navigation**

The WAI-ARIA APG radio-group pattern (referenced in the findings report) requires: only the checked radio is in the Tab order (`tabIndex={0}`), the other is `tabIndex={-1}`, and `ArrowLeft`/`ArrowUp` move selection to the previous option while `ArrowRight`/`ArrowDown` move to the next (wrapping is optional with only 2 options; do not wrap — 2-option groups conventionally just toggle). Modify the map over `(["ONLINE_DICE", "PHYSICAL_DICE"] as LotMethod[])`:

```tsx
<div role="radiogroup" aria-label="Способ жеребьёвки" className="grid grid-cols-2 gap-2">
  {(["ONLINE_DICE", "PHYSICAL_DICE"] as LotMethod[]).map((option) => {
    const active = mode === option;
    const Icon = option === "ONLINE_DICE" ? Dices : Hand;
    return (
      <motion.button
        key={option}
        type="button"
        role="radio"
        aria-checked={active}
        tabIndex={active ? 0 : -1}
        disabled={busy || disabled}
        whileTap={reduceMotion ? undefined : IMPULSE_TAP}
        transition={IMPULSE_SPRING}
        onClick={() => setMode(option)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          e.preventDefault();
          const other: LotMethod = option === "ONLINE_DICE" ? "PHYSICAL_DICE" : "ONLINE_DICE";
          setMode(other);
          (e.currentTarget.parentElement?.querySelector(
            `[role="radio"][aria-checked="true"]`,
          ) as HTMLElement | null)?.focus();
        }}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-2 text-xs transition-colors disabled:opacity-55",
          active
            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
            : "border-[var(--border-strong)] text-[var(--muted)] hover:bg-[var(--surface-muted)]",
        )}
      >
        <Icon className="size-3.5" strokeWidth={2} />
        {option === "ONLINE_DICE" ? "Онлайн" : "Живой кубик"}
      </motion.button>
    );
  })}
</div>
```

(The `querySelector` inside `onKeyDown` runs *after* `setMode` triggers a re-render on the next tick in React 18+ automatic batching — if focus doesn't land correctly in Step 3's live test because the DOM hasn't updated yet when the query runs, wrap the focus call in `requestAnimationFrame(() => ...)` or a `useEffect` keyed on `mode` instead of doing it inline; verify which is needed empirically in Step 3, don't guess.)

- [ ] **Step 3: Verify live — this widget could only be statically checked during the original audit (no fixture reached the lot-draw UI), so this is this fix's first live confirmation**

The local dev DB fixture tournament ("Smoke Cup") has zero disciplines configured, so the lot-draw UI still won't be reachable through normal navigation. Verify instead via a focused component-level check: if a Storybook-style isolated render isn't available in this project (check `frontend/` for one first; if none exists, don't add one just for this), read the modified code once more for correctness (tabIndex logic, arrow-key handler, `aria-checked` staying in sync with `mode`) and note in your task report that live browser confirmation wasn't possible for the same reason the original audit couldn't get one — carry this as a known limitation, don't fabricate a browser test that didn't happen.

- [ ] **Step 4: Confirm nothing broke**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/tournaments/lot-dice.tsx
git commit -m "fix(a11y): lot-dice radiogroup uses roving tabindex per WAI-ARIA APG pattern

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Give `EmptyState` a real heading element (shared primitive)

**Files:**
- Modify: `frontend/src/components/ui/index.tsx` (the `EmptyState` component, currently rendering `<p className="font-display text-lg font-semibold">{title}</p>` per the findings report — re-locate by reading the file, since Task 1-5 don't touch this file but line numbers may still have shifted since the audit)

**Interfaces:**
- Consumes: nothing from Tasks 1-5.
- Produces: `EmptyState` gains an optional `headingLevel` prop — note this in case a future task ever wants it, though none in this plan do.

- [ ] **Step 1: Read the current `EmptyState` implementation and every call site**

```bash
grep -rn "EmptyState" frontend/src/app frontend/src/features
```

Read `EmptyState`'s definition in `components/ui/index.tsx` and every place it's used (the findings report names `/clubs`, `/education`, `/rules` as current empty-data call sites).

- [ ] **Step 2: Change the title element, defaulting to `h2`**

The findings report notes this is context-dependent — every current usage already sits under a page that has its own `<h1>`, so `<h2>` is the correct default (never `<h1>`, which would create a second top-level heading on every page using it). Add an optional prop rather than hardcoding, so a future caller isn't stuck if `EmptyState` is ever used as a page's *only* content:

```tsx
export function EmptyState({
  title,
  description,
  action,
  icon,
  headingLevel: HeadingTag = "h2",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  /** Defaults to h2 — every current call site sits under a page that
   *  already has its own h1, so h2 is correct without a caller having to
   *  think about it. Override only if a future page ever uses EmptyState
   *  as its sole content directly under a bare h1. */
  headingLevel?: "h2" | "h3";
}) {
  return (
    <div className="ledger-lines rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-6 py-10 text-center">
      <div className="mx-auto mb-4 w-fit">
        <Seal size={46} tone="muted">
          {icon ?? <span aria-hidden="true" className="font-record leading-none">—</span>}
        </Seal>
      </div>
      <HeadingTag className="font-display text-lg font-semibold">{title}</HeadingTag>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
```

Do not change any call site — the new prop is optional and defaults to the correct value for every existing usage.

- [ ] **Step 3: Verify visually and structurally**

`npx tsc --noEmit` confirms the `HeadingTag` pattern (a capitalized variable used as a JSX tag) type-checks — this is a standard React pattern (dynamic element type), but confirm no TypeScript narrowing issue arises. Then live-check one route (`/clubs`, which the findings report says has an empty state currently) with Playwright: navigate, take a snapshot, confirm the accessibility tree now shows a heading role for the EmptyState title instead of no role, and confirm the visual appearance (font, size, weight) is unchanged — `<h2>` with the same Tailwind classes as the old `<p>` should render identically, since no default browser heading styles survive the explicit `font-display text-lg font-semibold` classes, but confirm this rather than assume it.

- [ ] **Step 4: Confirm nothing broke**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/index.tsx
git commit -m "fix(a11y): EmptyState renders its title as a heading, not a paragraph

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Add a live region to the hero mask/опись toggle (per-page)

**Files:**
- Modify: `frontend/src/features/home/hero-clash.tsx` (the `HeroIllustration` function, currently around lines 86-90)

**Interfaces:**
- Consumes: nothing from Tasks 1-6.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Read the current implementation**

Read `frontend/src/features/home/hero-clash.tsx`'s `HeroIllustration` function and confirm it still matches the findings report's description: renders either a `ClashCard`, `EquipmentPlate`, or the passed-in `mask` prop depending on `mode`/`clash` state, with no `aria-live` region anywhere in the swap.

- [ ] **Step 2: Wrap the swapped content in a live region**

```tsx
export function HeroIllustration({ mask }: { mask: ReactNode }) {
  const { clash, mode } = useClashStage();
  return (
    <div aria-live="polite" aria-atomic="true">
      {clash ? (
        <ClashCard a={clash.a} b={clash.b} nonce={clash.nonce} result={clash.result} />
      ) : mode === "equipment" ? (
        <EquipmentPlate />
      ) : (
        mask
      )}
    </div>
  );
}
```

(`aria-atomic="true"` ensures the whole region is re-announced on change, not just a diffed fragment — appropriate here since the entire illustration swaps, not a sub-part of it. Check whether the existing wrapping `<div>` this returns into, in `hero.tsx`, already has layout-affecting classes that would need to move onto this new wrapper — read `hero.tsx` around its `<HeroIllustration mask={<HelmetReveal />} />` call site (line ~98) to confirm this new `<div>` doesn't break the existing layout; if the parent already wraps this in a positioned/sized container, this new div is just an extra layer inside it and should be harmless, but verify visually in Step 3.)

- [ ] **Step 3: Verify live**

Navigate to `/` with Playwright, take a snapshot before and after clicking/activating the mask ⇄ опись toggle (`HeroIllustrationToggle`, reachable by keyboard per the original audit's Task 3 finding — use `browser_press_key` to Tab to it and press Enter, not a click), and confirm: the layout is visually unchanged (screenshot or bounding-box comparison), and the accessibility snapshot shows the live region's content differs between the two snapshots (confirming the swap is now inside an announced region).

- [ ] **Step 4: Confirm nothing broke**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/home/hero-clash.tsx
git commit -m "fix(a11y): announce the hero mask/опись content swap via aria-live

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Add `aria-label` to icon-only weapon-class filter buttons (per-page)

**Files:**
- Modify: `frontend/src/features/tournaments/tournament-path/bracket-grid.tsx:322-330` (the `title={label}` button)
- Modify: `frontend/src/features/tournaments/tournament-path/dossiers.tsx:146-155` (the `title={label}` button)
- Modify: `frontend/src/features/tournaments/tournament-path/lot-cube.tsx:204-212` (the `title={label}` button)

**Interfaces:**
- Consumes: nothing from Tasks 1-7.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Confirm these are the right three files**

```bash
grep -n "title={label}" frontend/src/features/tournaments/tournament-path/bracket-grid.tsx frontend/src/features/tournaments/tournament-path/dossiers.tsx frontend/src/features/tournaments/tournament-path/lot-cube.tsx
```

All three are part of the tournament-path demo flow directly imported into `frontend/src/app/tournaments/page.tsx` (confirmed via that page's own imports during this plan's authoring) — this is the "/tournaments page markup (dossier/roster filter controls)" the findings report refers to. If any of the three greps comes back empty (the pattern shifted since this plan was written), re-locate the icon-only `title`-labeled button in that file by reading it, and use the real current line numbers.

- [ ] **Step 2: Add `aria-label` alongside the existing `title` in each of the three files**

In each file, the button already computes a `label` variable used as `title={label}` — reuse it:

```tsx
<button
  key={key}
  type="button"
  title={label}
  aria-label={label}
  onClick={...}
  ...
>
```

Keep `title` (it's still useful as a desktop hover tooltip and doesn't conflict with `aria-label` — when both are present, `aria-label` wins for the accessible name per the accname spec, which is exactly the fix: axe already passed this via `title`, but `aria-label` is the robust, AT-consistent source). Do not remove `title`. Apply the identical one-line addition (`aria-label={label}`) in all three files — this is mechanical, not three different fixes.

- [ ] **Step 3: Verify live**

Navigate to `/tournaments` with Playwright, take an accessibility snapshot, and confirm each of the icon-only weapon-class buttons now reports an accessible name matching its label (e.g. "Безоружный", "Палка") in the snapshot's tree — not just a generic "button" with no name.

- [ ] **Step 4: Confirm nothing broke**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/tournaments/tournament-path/bracket-grid.tsx frontend/src/features/tournaments/tournament-path/dossiers.tsx frontend/src/features/tournaments/tournament-path/lot-cube.tsx
git commit -m "fix(a11y): add aria-label to icon-only weapon-class filter buttons

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Verify and, if still present, fix the focus-ring weight inconsistency (per-page)

**Files:**
- Modify (conditionally — see Step 1): `frontend/src/features/tournaments/tournament-ruleset-picker.tsx`

**Interfaces:**
- Consumes: nothing from Tasks 1-8.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Check whether this finding is still current**

The findings report cites `/tournaments/[id]`'s ruleset link using `outline: solid 1px` where the rest of the site uses `solid 2px`. This codebase's ruleset UI was rewritten (as `frontend/src/features/tournaments/tournament-ruleset-picker.tsx`) in a separate change that landed after the original audit ran. Check its current focus styling:

```bash
grep -n "focus-visible\|outline" frontend/src/features/tournaments/tournament-ruleset-picker.tsx
```

This plan's authoring found the current file already uses `focus-visible:shadow-[inset_0_0_0_2px_var(--gold)]` (a 2px inset shadow, not a 1px outline) at both of its interactive elements (around lines 80 and 159) — if your grep confirms the same, **this finding is already resolved by unrelated work** and there is nothing to fix. Skip to Step 4 and note in your task report that this was verified-already-fixed, not fixed by this task.

- [ ] **Step 2: If a 1px inconsistency genuinely still exists** (only if Step 1 found one)

Change the narrower outline to match the sitewide `2px` convention the findings report describes, keeping the same color/style, just doubling the width. Read the specific rule you found in Step 1 and make the minimal width-only change.

- [ ] **Step 3: If you made a change, verify live**

Navigate to `/tournaments/[id]` (tournament id `de5165f46c924c509d9b00613d5b4991`), Tab to the affected link, and screenshot or snapshot to confirm a visibly consistent 2px focus indicator.

- [ ] **Step 4: Confirm nothing broke** (run regardless of whether Step 2 made a change)

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

- [ ] **Step 5: Commit — only if Step 2 made a change**

```bash
git add frontend/src/features/tournaments/tournament-ruleset-picker.tsx
git commit -m "fix(a11y): match ruleset link's focus-ring weight to the sitewide 2px convention

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

If Step 1 found the finding already resolved, make no commit for this task — report it as verified-clean instead.

---

### Task 10: Compile a fix summary and update the findings report

**Files:**
- Modify: `docs/superpowers/specs/2026-09-13-accessibility-audit-findings.md` (add a short "Fix status" section)

**Interfaces:**
- Consumes: the commit SHAs and outcomes from Tasks 1-9 (read each task's git log entry, don't rely on memory of what earlier tasks did).
- Produces: the final state of the findings report, which nothing downstream consumes (this is the last task).

- [ ] **Step 1: Gather what actually happened**

```bash
git log --oneline --grep="fix(a11y)\|docs(a11y)" -10
```

List every commit this plan produced (Tasks 1-9, noting Task 9 may have made none per its own Step 5 caveat).

- [ ] **Step 2: Add a "Fix status" section to the findings report**

Insert a new section after the existing "## Handoff" section (the last section in the file) in `docs/superpowers/specs/2026-09-13-accessibility-audit-findings.md`:

```markdown
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
- **`focus-ring-weight-inconsistency`:** [fill in from Task 9's actual
  outcome — either "already resolved by an unrelated redesign, verified
  during this fix pass" or "fixed — outline width matched to 2px", whichever
  Task 9 actually found].
```

(Replace the bracketed Task 9 line with the real outcome — this is the one line in this section whose content genuinely isn't knowable until Task 9 runs.)

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-13-accessibility-audit-findings.md
git commit -m "docs(a11y): record fix status against the audit findings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
