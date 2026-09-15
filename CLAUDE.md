# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Mstina Platform — digital ecosystem for the Mstinskaya Tradition community: education, rules/regulations, instructors and judges, clubs, tournaments, athlete identity, equipment, and ratings. Tournament management is a major domain but not the whole product.

Two applications: `backend/` (FastAPI modular monolith) and `frontend/` (Next.js App Router + TypeScript + Tailwind v4). The frontend consumes the backend over `/api/v1/`; see `frontend/README.md` for its structure and rendering model.

## Commands

Backend commands run from `backend/`, frontend commands from `frontend/`.

```bash
# setup
python -m venv .venv
.venv\Scripts\activate          # Windows; source .venv/bin/activate on Linux/macOS
pip install -r requirements.txt
cp .env.example .env

# run locally (needs Postgres reachable via DATABASE_URL)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# or via Docker (backend + Postgres)
docker compose up --build

# migrations
alembic upgrade head
alembic revision -m "description"   # new migration

# tests
pytest                              # whole suite
pytest tests/test_clubs_api.py      # single file
pytest tests/test_clubs_api.py::test_name   # single test
```

```bash
# frontend (from frontend/)
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_BASE_URL, defaults to http://localhost:8000
npm run dev                  # http://localhost:3000
npm run build
npm run lint
npx tsc --noEmit
```

Tests don't need Postgres/Docker running: each test file spins up an in-memory `sqlite+aiosqlite` engine and overrides `app.core.database.get_db` via `app.dependency_overrides`, then drives the API through `fastapi.testclient.TestClient`. Health check once running: `curl http://localhost:8000/health`.

## Architecture

**Modular monolith**: one FastAPI deployable, domains isolated under `backend/app/modules/<domain>/`, each domain should only talk to another through its service layer, not by reaching into another domain's models directly (see `docs/architecture.md` guardrails).

Per-module layout (not every module has every layer yet):

```
modules/<domain>/
  models/     SQLAlchemy models (DeclarativeBase from app.models.base.Base)
  schemas/    Pydantic request/response models
  services/   business logic, static-method classes (e.g. AuthService, ClubService)
  routers/    FastAPI APIRouter, prefix="/api/v1/<domain>", included in app/main.py
```

Domains present: `identity`, `auth`, `clubs`, `athletes`, `education`, `rules`, `tournaments`, `ratings`, `media`, `equipment`, `role_requests`. Domain responsibilities and entity relationships are documented in `docs/domain-model.md` (canonical) and `docs/architecture.md`; `docs/database.md`, `docs/api.md`, `docs/user-flows.md`, `docs/er-diagram.md`, `docs/tournament-engine.md`, `docs/clubs-domain.md` go deeper per area. Read the relevant doc before adding entities/endpoints to a domain — several documents state explicit modeling rules (e.g. roles are many-to-many over time, not a single field; club membership and rule versions are historical, never overwritten in place).

All API routes are versioned under `/api/v1/`. Config is `pydantic-settings` in `app/core/config.py` (reads `.env`); DB session/engine live in `app/core/database.py` and are swapped wholesale in tests (see above) rather than using FastAPI overrides for the engine itself. `CORS_ORIGINS` (comma-separated) controls which browser origins may call the API — the frontend origin must be listed there.

The `tournaments` module exports **three** routers from `routers/__init__.py` (`router`, `engine_router`, `read_router`), all mounted side by side in `app/main.py`. Do not nest them: `engine`/`read` carry their own `/api/v1` prefix, so including them inside the `/api/v1/tournaments`-prefixed router doubles the prefix. Writes live in `engine.py`/`tournaments.py`; every read projection (competition/participant/team/match views with resolved names, standings, bracket tree, journal) lives in `read.py` + `services/read_service.py` + `schemas/views.py`.

Match results are append-then-correct: `POST /matches/{id}/result` creates and returns 409 if one exists; `PUT /matches/{id}/result` corrects it and copies the previous values into a `MATCH_UPDATED` competition event so the change stays auditable.

### Frontend

Next.js App Router. Public pages are server components fetching with `cache: "no-store"`; mutations happen in client components. `next.config.ts` proxies `/api/v1/*` to the backend so browser requests are same-origin, which is what lets the session live in a plain `SameSite=Lax` httpOnly cookie rather than `localStorage` — `lib/api.ts` sends `credentials: "include"` and never handles a token directly. See `frontend/README.md` for the directory layout and the rule that the standings table shows counts only, never invented ranking points.

### Auth: `app/modules/auth` is canonical; `identity` is the data/service layer

`app/modules/auth/` owns every route at `/api/v1/auth/*` plus `/api/v1/users/me` (`me_router`), and is what the frontend and every test talk to. It issues the session as httpOnly cookies (`access_token`, `refresh_token`; see `auth/router.py`) — login/register/refresh return only `{"message": ...}` in the body, never a token, so nothing on the page can read one out of a response the way `localStorage` used to let XSS do. `app/core/session_auth.py` is the `get_current_user` dependency every *other* module actually depends on (cookie first, `Authorization: Bearer` header as an explicit-credential fallback for non-browser callers and tests).

`app/modules/identity/` has no route of its own: `docs/clubs-domain.md` rule 5 says changes here should stay rare and deliberate, so it stays confined to the `User`/`Role`/`Profile`/`Permission` models and the auth *logic* that operates on them (password hashing, `register_user`/`authenticate_user`, the `get_user_me` projection) — `auth` calls into these rather than duplicating them. `app/core/identity_access.py` and `app/core/privileged_access.py` are the read-only wrappers other domains use to reach identity's data without importing its models directly (same "cannot modify identity" constraint).

One deliberate, documented exception to that constraint: `email_verified_at` lives on identity's `User` model, added for email verification at registration — see `docs/superpowers/specs/2026-09-14-email-verification-design.md` for why.

A second: `AuthService.assign_role` (identity) and its `app/core/identity_access.py` wrapper `assign_role` are the only place a `UserRole` row gets created outside registration's default `USER` grant — the `role_requests` module (self-service requests for `INSTRUCTOR`/`ORGANIZER`/`JUDGE`/`MODERATOR`, reviewed by whoever holds `MODERATOR`) calls this once a request is approved rather than writing to identity's tables itself. See `docs/superpowers/specs/2026-09-15-role-requests-design.md`.

## Guardrails from docs/architecture.md

- Don't mix frontend and backend design decisions in one task.
- Preserve historical data; never mutate versioned rules or past results in place.
- Authorization/validation must be backend-driven, not just enforced client-side.
- Don't invent judging/tournament rules (number of judges, fight structure, victory conditions, penalties, formats, rating system) — `docs/domain-model.md` §5 lists these as explicitly unconfirmed by the real Mstinskaya Tradition regulations. `docs/tournament-engine.md` also states results store only the decision, not point scores, and judging is real-world, not live scoring.
- Prefer small, explicit iterations over broad feature implementation.
