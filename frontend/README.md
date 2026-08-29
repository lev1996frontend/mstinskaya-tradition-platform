# Frontend — Mstina Platform

Next.js (App Router) + TypeScript + Tailwind CSS v4. Consumes the FastAPI backend in `../backend`.

## Running

```bash
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_BASE_URL, defaults to http://localhost:8000
npm run dev                    # http://localhost:3000
npm run build && npm start
npm run lint
npx tsc --noEmit
```

The backend must allow the frontend origin: set `CORS_ORIGINS` in `backend/.env`
(it already defaults to `http://localhost:3000`). Server components call the API
directly and are not subject to CORS; only browser-side mutations are.

## Structure

Follows the layout recommended in `docs/architecture.md`:

```
src/
  app/          routes (App Router)
  api/          typed endpoint wrappers, one module per backend area
  components/   shared UI primitives and layout chrome
  features/     domain components (auth, tournaments)
  lib/          api client, config, formatting, RU labels for backend enums
  types/        wire types mirroring the FastAPI response models
```

## Rendering model

Public pages are **server components**: they fetch on the server, render for SEO,
and never cache tournament data (`cache: "no-store"`) because results change
during an event.

Anything that writes is a **client component** using a bearer token from
`localStorage` (`features/auth/auth-context.tsx`). After a successful mutation the
page calls `router.refresh()`, which re-runs the server component so the standings,
bracket and match list all pick up the new result together.

`lib/api.ts` distinguishes three outcomes: success, `ApiError` (backend replied),
and `ApiUnreachableError` (backend down). List pages degrade to an "API offline"
notice instead of crashing.

## Tournaments

The tournament screens are the deepest part of the app:

- `/tournaments` — list, live events sorted first
- `/tournaments/[id]` — event overview, disciplines, categories, documents
- `/tournaments/[id]/competitions/[competitionId]` — the working screen, with tabs
  for participants, teams, standings, bracket, matches and the change journal

Which tabs appear depends on the competition format: a standings table for
`ROUND_ROBIN` / `GROUP_PLAYOFF`, a bracket for `SINGLE_ELIMINATION` /
`GROUP_PLAYOFF`, teams only for team competitions.

**The standings table shows counts only** — matches, wins, losses, results without
a winner — and never points or an official placement. Ties are marked rather than
broken. The rating system and tie-break rules are listed as unconfirmed in
`docs/domain-model.md` §5, and the frontend must not invent them.
