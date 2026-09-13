# Accessibility audit — design

Date: 2026-09-13
Status: approved by user, pending spec review

## Problem

The frontend has never had an accessibility pass. It is animation-heavy
(framer-motion throughout) and has several bespoke interactive widgets — a
custom cursor, a 3D lot-throw cube, a mask/опись toggle, a monogram flip,
weapon-themed decorative components — none of which have been checked for
keyboard operability, screen-reader semantics, or `prefers-reduced-motion`
support. There is no existing WCAG audit or checklist for this codebase.

## Scope (confirmed with user)

- **Standard: WCAG 2.1 AA.**
- **Interface/chrome only**, mirroring the data/interface boundary drawn in
  the i18n design: keyboard operability, focus visibility, color contrast,
  semantic structure (landmarks, heading hierarchy), accessible names for
  icon-only controls and custom widgets, accessible form errors, and
  `prefers-reduced-motion` support for the named animated widgets above.
- **No backend changes.** Frontend presentation layer only, per
  `CLAUDE.md`'s guardrail against mixing frontend and backend decisions in
  one task.
- **This pass: audit + fixes only.** No new automated enforcement
  (`eslint-plugin-jsx-a11y`, axe-in-CI) is added now — the user explicitly
  deferred that; it stays a future option, not part of this scope.

## Approach

**Two-pass audit**, matching the user's "code + browser" choice:

1. **Static pass.** Read `components/ui/*` primitives and each feature
   component for missing labels/roles/keyboard handlers, and check heading
   hierarchy per page.
2. **Dynamic pass.** Reuse the Playwright-against-`localhost:3000` method
   from the prior mobile/responsive audit (14 routes: the 13 `page.tsx`
   routes — `/`, `/athletes`, `/athletes/[id]`, `/clubs`, `/education`,
   `/equipment`, `/login`, `/register`, `/profile`, `/rules`, `/rules/[id]`,
   `/tournaments`, `/tournaments/new`, `/tournaments/[id]` — plus the nested
   `/tournaments/[id]/competitions/[competitionId]` detail page). Per route:
   - Inject `axe-core`, capture violations by impact
     (critical/serious/moderate/minor).
   - Walk tab order: confirm every focusable element has a visible focus
     ring and the sequence is logical.
   - Inspect the accessibility tree for icon-only buttons and the named
     custom widgets (lot-dice cube, mask/опись toggle, monogram flip, custom
     cursor) — do they expose a name/role, and do they work without a
     pointer?
   - Check whether animated widgets respect `prefers-reduced-motion`
     (expected: none currently do).

Rejected alternative: **code-only audit.** Faster and needs no dev server,
but would miss runtime-only problems — actual focus-ring rendering, real tab
order, live contrast values behind CSS custom properties/gradients — the
same reasoning that justified using Playwright for the mobile audit rather
than trusting the markup alone.

## Output

- Findings written to a report (this document's companion, produced during
  the audit itself, not invented here) grouped the same way the i18n plan
  phased its work — shared primitives vs. per-page — and ranked by
  severity, so the highest-leverage fixes are visible first.
- That findings doc feeds the `writing-plans` skill for a phased
  **fix** plan:
  - **Phase 1 — shared primitives.** `components/ui/*` (Button, Card,
    Field, Alert, etc.), header/footer, a global focus-visible style, and
    `prefers-reduced-motion` handling applied once at the animation-library
    level where possible rather than per-component.
  - **Phase 2 — per-feature fixes**, ordered by traffic/importance:
    tournaments → athletes/rules → clubs/equipment/education → auth
    (login/register) → remaining misc pages. Small, explicit iterations per
    `docs/architecture.md`'s guardrail, not one broad PR.

## Testing

- After each fix phase: re-run the Playwright + axe-core pass on the routes
  touched by that phase.
- Manual tab-through of any custom widget touched.
- `npx tsc --noEmit` and `npm run lint` clean after each phase.
- No CI/lint automation added in this pass (see Scope).

## Explicitly out of scope

- Automated enforcement (`eslint-plugin-jsx-a11y`, axe-in-CI/tests) — future
  option, not part of this pass.
- Backend/API changes of any kind.
- Translating or otherwise changing the i18n effort's boundaries.
- WCAG levels beyond AA (no AAA pass).
- Fixing issues found in third-party embedded content, if any is
  discovered, beyond what this codebase directly controls.
