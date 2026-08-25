# Architecture Overview

## Product vision

Mstina Platform is a modular digital ecosystem for the Mstinskaya Tradition community. The platform brings together educational content, rules, tournament information, athlete and club profiles, equipment, and future community services under one maintainable architecture.

The repository name is intentionally technical: MstinskayaTraditionPlatform. The public-facing product name can remain Mstina.

## Architectural direction

The project should follow a modular monolith:

- one deployable backend application;
- clear domain boundaries inside the codebase;
- independent feature modules;
- gradual expansion without premature distributed complexity.

## Core domains

1. Auth and users

   - authentication
   - roles and permissions
   - user profiles
   - club membership relationships

2. Education

   - courses
   - modules
   - lessons
   - videos and documents
   - progress and certificates

3. Rules and regulations

   - rule sets
   - rule versions
   - sections and rules
   - historical traceability

4. Tournaments

   - tournament entities
   - categories and stages
   - participants and fights
   - results and judging records

5. Equipment and commerce

   - product catalog
   - sellers and orders
   - compatibility with rule requirements

6. Media

   - reusable media model
   - centralized storage metadata
   - access control for private assets

7. Ratings and community data
   - athlete statistics
   - rating history
   - accreditation and recognition

## Domain boundaries

Each domain should expose explicit services and interfaces rather than directly depending on other domains' internals. This protects historical data, reduces accidental cross-domain coupling, and keeps future growth manageable.

## Frontend direction

The frontend is a Next.js + TypeScript application with SEO-friendly public pages and a richer authenticated experience where needed.

Recommended structure:

- app/
- features/
- components/
- api/
- hooks/
- stores/
- types/
- lib/

The public site should prioritize readable educational and rule content, while authenticated areas can behave more like an application.

## Backend direction

The backend uses FastAPI, SQLAlchemy 2.x, PostgreSQL, Alembic, and Redis as needed.

The API should be versioned under /api/v1/ and should be resource-oriented.

## Data and storage

Large files, including videos, images, and PDFs, should not sit directly in PostgreSQL. They should be stored in S3-compatible object storage with metadata retained in the database.

This keeps the relational model clean while preserving access control and relationships.

## Scalability and future growth

The architecture intentionally avoids microservices, Kubernetes, and event-driven distributed complexity at the start. It is designed to scale within a modular monolith while staying easy to reason about.

This keeps the system aligned with the product's actual early needs while maintaining clear boundaries for future features including advanced tournament management, ratings, accreditation, and larger media workflows.

## Important guardrails

- do not mix frontend and backend design decisions in one task;
- preserve historical data and versioned rules;
- keep authorization and validation backend-driven;
- avoid making assumptions about undocumented judging rules;
- prefer small, explicit iterations over broad feature implementation.
