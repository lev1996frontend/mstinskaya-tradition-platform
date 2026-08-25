## Project

This project is a web platform for the Mstinskaya Tradition (Мстинская традиция).

The platform is intended to become a unified digital platform for the community:

- educational materials and video lessons;
- rules and regulations;
- materials for instructors and judges;
- tournaments and tournament results;
- athletes, instructors, judges and clubs;
- equipment and weapon catalog;
- orders and sellers;
- ratings, certificates and accreditation in later stages.

The project is designed as an extensible platform, not as a single tournament website.

---

## Core Product Principles

### 1. Content first

The primary value of the platform is structured knowledge:

- lessons;
- videos;
- rules;
- regulations;
- methodological materials;
- judging materials;
- safety information.

Content must be organized and searchable, not stored as arbitrary pages.

### 2. Tournament management is a separate domain

Tournament functionality must be independent from education, equipment and content.

A tournament may contain:

- categories;
- participants;
- stages;
- fights;
- judges;
- results;
- schedules;
- documents;
- photos and videos.

### 3. Judging is NOT an online scoring system

Do not assume that judges will score fights through buttons during a fight.

The real-world judging process is performed by physical judges/referees according to the applicable rules.

The platform should primarily:

- store judging rules;
- provide judging education;
- provide video examples and disputed situations;
- record the judging panel;
- record the final result of a fight;
- preserve historical tournament data.

Do NOT introduce `ScoreEvent`, `JudgeScore`, point buttons or live scoring unless the actual Mstinskaya Tradition regulations explicitly require them.

Future electronic judging may be added as a separate feature.

### 4. Rules are versioned

Rules may change over time.

A tournament must reference the exact rule/regulation version used for that tournament.

Historical tournament results must remain interpretable even after new rules are published.

Never overwrite historical rules in place.

Prefer:

`RuleSet -> RuleVersion -> RuleSection -> Rule`

rather than one mutable `rules` table.

### 5. One person may have multiple roles

A user can simultaneously be:

- athlete;
- instructor;
- judge;
- organizer;
- administrator.

Do not implement a single `user.role` field as the main authorization model.

Use:

`User -> UserRole -> Role`

and permissions where appropriate.

---

# Technology Stack

## Frontend

- Next.js
- React
- TypeScript
- App Router
- TanStack Query
- React Hook Form where appropriate
- Zod for client-side validation
- Tailwind CSS or another consistent UI system

The public website must support SEO-friendly rendering.

Authenticated application areas may behave like an SPA.

Do not replace Next.js with a pure Vite SPA unless there is a specific architectural reason.

---

## Backend

- Python
- FastAPI
- SQLAlchemy 2.x
- PostgreSQL
- Alembic
- Redis
- background jobs when actually required

Use REST API as the primary frontend/backend communication mechanism.

API must be versioned:

`/api/v1/...`

Do not introduce GraphQL unless there is a demonstrated requirement.

---

## Storage

Large files must not be stored directly in PostgreSQL.

Use S3-compatible object storage for:

- videos;
- images;
- PDFs;
- documents;
- other large media.

PostgreSQL stores metadata and relationships.

Example:

`Media -> storage_key`

not:

`Media -> binary file content`

---

## Deployment

Initial deployment should use a modular monolith.

Recommended infrastructure:

- Docker
- PostgreSQL
- Redis
- S3-compatible object storage
- reverse proxy
- CI/CD

Do NOT introduce:

- Kubernetes;
- microservices;
- service mesh;
- event-driven distributed architecture;

unless actual scale or operational requirements justify them.

---

# Architecture

Use a modular monolith.

The backend should be one deployable FastAPI application but logically divided into independent domains.

Recommended domains:

```text
auth
users
clubs

education
rules
media

equipment
orders

tournaments
athletes
judging
ratings

notifications
admin
```

Domains should not freely access each other's internal implementation details.

Prefer explicit service interfaces and domain-level operations.

---

# Domain Model

## Users

Core entities:

```text
User
Role
Permission
UserRole
Profile
```

Users are the central identity of the platform.

Do not duplicate authentication accounts for different roles.

---

## Clubs

Core entities:

```text
Club
ClubMember
```

A user may have historical membership in clubs.

Do not assume that a user has only one club for their entire lifetime.

---

## Athletes

Core entity:

```text
Athlete
```

An athlete is linked to a User.

Tournament participation must be represented by a separate participation entity.

Do not put tournament-specific state directly into `Athlete`.

---

## Education

Core entities:

```text
Course
CourseModule
Lesson
Media
LessonMedia
CourseProgress
LessonProgress
Test
TestAttempt
Certificate
```

Recommended hierarchy:

```text
Course
  -> Module
      -> Lesson
          -> Media
          -> Documents
          -> Test
```

The same media system may be reused by:

- lessons;
- tournaments;
- products;
- rules;
- news.

---

# Rules

Core entities:

```text
RuleSet
RuleVersion
RuleSection
Rule
```

Recommended hierarchy:

```text
RuleSet
  -> RuleVersion
      -> RuleSection
          -> Rule
```

Rules must support historical versions.

A tournament references a specific `RuleVersion`.

Never silently change the meaning of an old rule version.

---

# Tournaments

Core entities:

```text
Tournament
TournamentCategory
TournamentStage
Participant
Fight
FightJudge
FightResult
```

Recommended hierarchy:

```text
Tournament
  -> Category
      -> Stage
          -> Fight
```

A participant is a tournament-specific representation of an athlete.

Do not use `Athlete` directly as the tournament participant record.

---

# Fight and Judging

The minimum fight model should support:

```text
Fight
Participant A
Participant B
Judging panel
Result
```

Judging panel may contain multiple people.

Use a relation similar to:

```text
Fight
  -> FightJudge
       -> User
       -> judging role
```

Possible roles may include:

- referee;
- judge;
- chief judge;

but actual roles must be based on the official regulations.

Do not invent judging roles without evidence from the domain rules.

The platform should store the final decision/result rather than fake granular scoring.

Possible result types may include:

```text
VICTORY
DISQUALIFICATION
WITHDRAWAL
TIME_LIMIT
DRAW
```

These are examples only. Final result types must be derived from the actual tournament regulations.

---

# Tournament Regulations

A tournament should reference:

```text
RuleVersion
```

Example:

```text
Tournament 2027
    -> RuleVersion 2026.2
```

This is required for historical integrity.

Do not rely on the current global rules when displaying historical tournaments.

---

# Ratings

Rating is a separate domain.

Recommended entities:

```text
AthleteRating
RatingHistory
```

Conceptually:

```text
FightResult
    -> TournamentResult
        -> RatingCalculation
            -> RatingHistory
                -> AthleteRating
```

Do not hard-code the rating algorithm into tournament result creation.

Rating rules may change independently.

---

# Equipment

Core entities:

```text
ProductCategory
Product
ProductVariant
Manufacturer
Seller
EquipmentRequirement
```

Products may be associated with rule requirements.

Example:

```text
Rule
  -> EquipmentRequirement
      -> Product
```

This allows the platform to show equipment compatible with a particular regulation.

---

# Orders

Core entities:

```text
Order
OrderItem
```

An order item must store the price at the time of purchase.

Do not calculate historical order totals from the current product price.

Example:

```text
OrderItem
    product_variant_id
    quantity
    unit_price
```

A full payment system is not required for the initial MVP.

---

# Media

Use a reusable media abstraction.

Example:

```text
Media
 ├── Video
 ├── Image
 ├── Document
 └── File
```

Media may be connected to multiple domains through explicit relationships.

Do not duplicate file-storage logic in every domain.

---

# API Design

Use:

```text
/api/v1/
```

Recommended initial groups:

```text
/api/v1/auth
/api/v1/users
/api/v1/clubs

/api/v1/courses
/api/v1/lessons
/api/v1/progress
/api/v1/certificates

/api/v1/rules
/api/v1/media

/api/v1/products
/api/v1/orders

/api/v1/tournaments
/api/v1/participants
/api/v1/fights
/api/v1/results

/api/v1/ratings
```

Use REST semantics consistently.

Avoid generic endpoints such as:

```text
/api/save
/api/process
/api/data
```

Prefer resource-oriented endpoints.

---

# Authentication and Authorization

Authentication:

- access token;
- refresh token;
- secure password hashing;
- email verification when required;
- account activation/deactivation.

Authorization:

```text
User
  -> Role
      -> Permission
```

Example permissions:

```text
tournament.read
tournament.create
tournament.update
tournament.manage_participants

judging.read
judging.manage

education.read
education.manage

rules.read
rules.manage

products.read
products.manage

orders.create
orders.manage
```

Do not rely only on frontend route protection.

All important permissions must be enforced by the backend.

---

# Database Principles

Use PostgreSQL.

Use UUID or another consistent non-sequential public identifier strategy if appropriate for the API.

Use:

- foreign keys;
- unique constraints;
- check constraints where useful;
- indexes based on real query patterns;
- timestamps;
- soft deletion only where business requirements justify it.

Do not add indexes blindly.

Do not store structured domain data as JSON when a relational model is more appropriate.

JSONB is acceptable for genuinely flexible metadata.

---

# Historical Integrity

Historical data is important.

The following must remain reproducible:

- tournament result;
- tournament regulation;
- athlete participation;
- judging panel;
- rating calculation history;
- issued certificate;
- historical order price.

Do not overwrite historical records in ways that change their meaning.

Prefer immutable history plus new versions.

---

# Frontend Architecture

Recommended structure:

```text
src/
├── app/
├── features/
│   ├── auth/
│   ├── education/
│   ├── rules/
│   ├── equipment/
│   ├── tournaments/
│   ├── ratings/
│   └── profile/
│
├── components/
├── api/
├── hooks/
├── stores/
├── types/
└── lib/
```

Keep business-specific code inside its domain feature.

Do not create a giant global `components` directory containing all application logic.

---

# UI Principles

The public platform should prioritize:

1. learning;
2. discovering rules;
3. finding equipment;
4. discovering tournaments;
5. viewing athletes/clubs;
6. accessing community information.

The interface should be simple enough for users who are not technically advanced.

The platform is not an enterprise admin panel.

---

# Security

Never trust frontend validation.

Validate all important input on the backend.

Use:

- password hashing;
- authorization checks;
- input validation;
- rate limiting where appropriate;
- secure HTTP headers;
- CSRF protection where applicable;
- secure cookie/token handling;
- file upload validation;
- access control for private media.

Private videos and documents must not be publicly accessible merely because their storage URL is known.

Use signed/temporary URLs where appropriate.

---

# File Uploads

Do not upload large files through the application server unnecessarily.

Preferred flow:

```text
Frontend
   ↓
request upload permission
   ↓
FastAPI
   ↓
signed upload URL
   ↓
S3
   ↓
metadata saved in PostgreSQL
```

For videos, consider asynchronous processing/transcoding when required.

Do not implement video transcoding until the actual requirements are known.

---

# Development Rules

Before implementing a new feature:

1. Identify its domain.
2. Identify affected entities.
3. Check existing relationships.
4. Check whether the feature changes historical data.
5. Check authorization requirements.
6. Check whether the functionality belongs in the backend or frontend.
7. Add migrations for schema changes.
8. Add tests for important business rules.

Do not modify the database schema casually.

---

# Testing

At minimum:

## Backend

- unit tests for business logic;
- API tests;
- authorization tests;
- database integration tests for critical flows.

## Frontend

- component tests where useful;
- tests for critical user flows;
- validation tests.

## Critical scenarios

Test at least:

- registration/login;
- role assignment;
- course progress;
- certificate issuance;
- tournament creation;
- participant registration;
- fight creation;
- result recording;
- rating calculation;
- product ordering;
- access to private media.

---

# MVP Scope

The first version should prioritize:

## Phase 1

```text
Authentication
Users
Roles
Clubs
```

## Phase 2

```text
Courses
Lessons
Video
Rules
Documents
```

## Phase 3

```text
Tournaments
Categories
Participants
Stages
Fights
Results
```

## Phase 4

```text
Equipment catalog
Products
Sellers
Orders
```

## Phase 5

```text
Ratings
Certificates
Judge accreditation
Statistics
Advanced tournament management
```

Do not implement all phases at once.

---

# Explicit Non-Goals for Initial Version

Do not implement initially:

- microservices;
- Kubernetes;
- GraphQL;
- mobile applications;
- complex event-driven architecture;
- full marketplace;
- integrated payment processing;
- automatic electronic judging;
- live judge scoring;
- AI judging;
- real-time scoring infrastructure.

These may be considered later when there is a demonstrated business requirement.

---

# Important Domain Rule

Never infer the exact rules of the Mstinskaya Tradition from HEMA or another martial art.

Analogous systems may be used for architectural inspiration only.

The actual:

- fight format;
- judging procedure;
- judge roles;
- victory conditions;
- penalties;
- weapon rules;
- tournament formats;

must be derived from the official Mstinskaya Tradition regulations provided for this project.

When the rules are ambiguous, do not silently invent behavior.

Mark the ambiguity and ask for clarification.

---

# Code Quality

Prefer:

- explicit code;
- small modules;
- clear domain boundaries;
- type safety;
- dependency injection;
- reusable services;
- meaningful names;
- database constraints;
- automated tests.

Avoid:

- premature abstractions;
- generic repositories everywhere;
- massive service classes;
- global state;
- duplicated business logic;
- hidden side effects;
- magic constants;
- unnecessary dependencies.

---

## Development Workflow

Always work in small iterations.

Before coding:

1. Read AGENTS.md.
2. Read related documentation.
3. Explain proposed changes.
4. Wait for approval before large architectural changes.

Never implement multiple domains in one task.

---

# Architectural Decision Rule

When choosing between two implementations:

1. Prefer the simpler solution.
2. Preserve domain boundaries.
3. Preserve historical data.
4. Avoid premature scalability.
5. Keep future extension possible.
6. Prefer real domain requirements over assumptions.

The goal is not to build the most technologically complex system.

The goal is to build a maintainable platform that can grow with the Mstinskaya Tradition community.
