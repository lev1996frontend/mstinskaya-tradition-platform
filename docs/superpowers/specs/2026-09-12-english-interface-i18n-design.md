# English interface (i18n) — design

Date: 2026-09-12
Status: approved by user, pending spec review

## Problem

The frontend is Russian-only: no i18n library, no message catalogs, every
string hardcoded in components. The user wants a real English version of the
site, not a cosmetic pass.

## Scope (confirmed with user)

- **Interface only.** Navigation, buttons, labels, static copy, and the
  lookup tables in `lib/labels.ts` (enum → human label, e.g.
  `documentType`, `competitionFormat`) get English translations.
- **Data stays Russian.** Tournament names, athlete names, club names, rule
  text, and any other content entered by real users through the app is
  **not** translated. It is real community data in Russian and stays that
  way regardless of which interface language is active.
- Scale: a grep for Cyrillic text across `frontend/src` found **111 files**
  containing Russian strings. This is a multi-phase project, not a single
  pass.

## Approach

**next-intl**, with locale-prefixed routing (`/en/...`), Russian staying
unprefixed at `/...` (next-intl's "as-needed" locale prefix mode).

Rejected alternatives:
- **Hand-rolled `[locale]` + Context, no library.** Full control, zero new
  dependency, but reimplements what next-intl already solves (ICU
  pluralization, missing-key detection, number/date formatting) for no
  benefit — this codebase already depends on several libraries
  (framer-motion, lucide-react) so avoiding one more isn't a stated value
  here.
- **react-i18next.** Mature, but its React Server Component support is
  weaker/newer than next-intl's. This app is built almost entirely on async
  Server Components (pages fetch directly from the backend API in the
  component body) — next-intl's `getTranslations()` is first-class for that
  pattern; i18next's is not.
- **Next.js's built-in Pages Router i18n routing.** Not available in the App
  Router at all — not a real option.

## Architecture

- `app/` becomes `app/[locale]/...` (or is wrapped via next-intl's routing
  middleware — exact mechanism decided at implementation time by whichever
  next-intl setup guide matches this project's Next.js version, per
  `frontend/AGENTS.md`'s warning that this Next.js build has breaking
  changes from the trained-on version).
- Message catalogs: `messages/ru.json` and `messages/en.json`, namespaced
  roughly by feature area (nav, tournaments, rules, athletes, clubs,
  equipment, education, auth, common) so files stay reviewable instead of
  one flat 111-file-worth of keys.
- Server Components call `getTranslations(namespace)`; Client Components use
  `useTranslations(namespace)`.
- `lib/labels.ts`'s lookup tables (already a single centralized place mapping
  backend enum values to Russian labels) gain English counterparts through
  the same catalog mechanism — this is the highest-leverage single file
  since its labels appear across many pages.
- `<html lang>` is set per locale in the root layout; `generateMetadata`
  produces localized `<title>`/`description` per page; `hreflang` alternate
  links are added for SEO.
- A language switcher is added to the header (exact visual treatment is an
  implementation-time design decision, not fixed here — should follow the
  site's existing "reuse the established hover/interaction language, don't
  invent a fourth" rule from this session's other work).
- Backend, database, and API contracts are untouched. This is a
  frontend-only, presentation-layer change — no new `Accept-Language`
  handling needed server-side beyond what next-intl's routing middleware
  does client/edge-side.

## Data flow

Unaffected. API responses continue to return whatever Russian content real
users entered, regardless of interface locale. The interface locale governs
only which message catalog renders the surrounding chrome (labels, buttons,
static copy, enum-label lookups).

## Phased plan (high level — task-level detail belongs in the implementation plan, not here)

1. **Infrastructure.** Install next-intl, set up routing/middleware, restructure
   routing to support the locale segment, wire one test string end-to-end on
   both `/` and `/en`, add the header language switcher. Exit criteria: both
   locales resolve, one real string renders differently on each, `tsc`/`lint`
   clean.
2. **Highest-leverage shared surface.** `lib/labels.ts`, header nav, footer,
   `components/ui/*` (Button, Card, Field, Alert, etc. — anywhere a string
   lives in a shared primitive rather than a page).
3. **Per-feature migration**, translated by the user's request personally
   (not parallelized across agents) to keep domain terminology (жребий,
   разряд, положение, стенка, регламент, and others) consistent — a glossary
   drifting between parallel translators was explicitly the risk flagged and
   avoided. Order: tournaments → rules → athletes → clubs → equipment →
   education → auth (`login`/`register`) → remaining misc pages.
4. **SEO pass.** `hreflang` alternates, per-locale metadata, sitemap entries
   for `/en/*` routes if a sitemap exists.

## Testing

- `npx tsc --noEmit` and `npm run lint` after every phase (as this session's
  other work has done throughout).
- Manual check: every route loads on both `/` and `/en/` without a runtime
  error or a visibly untranslated string in chrome.
- A missing-translation-key should fail loudly (next-intl's default
  behavior) rather than silently falling back, so gaps surface during
  development rather than shipping as a mystery blank/key-name string.

## Explicitly out of scope

- Translating tournament/athlete/club/rules **data**.
- Any third or additional language beyond Russian/English.
- Machine translation or per-record translation fields in the database.
- Automated/parallel-agent translation of feature copy (rejected above for
  terminology-consistency reasons).
