# Database Design

## Overview

The database is the foundation for historical integrity, domain separation, and secure access control. The project should use PostgreSQL with SQLAlchemy models and Alembic migrations.

The design must preserve historical records, especially for rules, tournament results, participation, ratings, and orders.

## Core principles

- prefer relational models over JSON-heavy storage for core domain data;
- use explicit tables for domains with strong relationships;
- keep historical snapshots rather than overwriting old data;
- use UUIDs or another consistent non-sequential strategy where suitable;
- define indexes only where real query patterns justify them.

## Core entities

### Users and roles

- User
- Role
- Permission
- UserRole
- Profile

The system should not model authorization as a single role field on the user table. Users may hold multiple roles across time and context.

### Clubs

- Club
- ClubMember

A user may belong to multiple clubs over time, so membership should be modeled as a historical relationship instead of a static single-club field.

### Athletes

- Athlete

Athlete information is tied to a user, but tournament participation should be modeled separately as a distinct participation record rather than placing tournament-specific state directly on the athlete itself.

### Rules

- RuleSet
- RuleVersion
- RuleSection
- Rule

The hierarchy should be:

RuleSet -> RuleVersion -> RuleSection -> Rule

This preserves versioning and avoids mutating historical rules in place.

### Tournaments

- Tournament
- TournamentCategory
- TournamentStage
- Participant
- Fight
- FightJudge
- FightResult

The tournament model should stay separate from educational content and equipment domains. A participant is a tournament-specific entity that references an athlete, not the athlete record itself.

### Media

- Media
- MediaType or domain-specific media relationships

A reusable media abstraction allows the same asset system to support lessons, rules, tournaments, and products without duplicating file logic.

### Orders

- Order
- OrderItem

Order items should store the purchase price at the time of the transaction to preserve historical correctness.

## Relationships

Key relationships should be explicit and directional:

- User 1-to-many UserRole
- Role many-to-many User through UserRole
- User 1-to-many Profile
- User 1-to-many ClubMember
- Club 1-to-many ClubMember
- User 1-to-one Athlete
- Athlete 1-to-many Participant
- Tournament 1-to-many Stage
- Stage 1-to-many Fight
- Fight many-to-many Judge through FightJudge
- Tournament many-to-one RuleVersion
- RuleSet 1-to-many RuleVersion
- RuleVersion 1-to-many RuleSection
- RuleSection 1-to-many Rule

## Historical integrity requirements

The following must remain reproducible:

- tournament results;
- tournament regulation version;
- athlete participation;
- judging panel;
- rating history;
- issued certificates;
- order pricing.

This means the system should prefer immutable records and versioned references over mutation of existing historical records.

## Suggested migration strategy

Initial migration work should focus on foundational entities only:

- User
- Role
- UserRole
- Club
- Athlete

These form the base identity and membership layer required before the project expands into education, rules, and tournaments.

## Future extension

The database should remain extensible for:

- education modules and lesson progress;
- rule section and regulation storage;
- tournament and fight records;
- equipment and product catalog data;
- ratings and certificates.

The database should not be designed around speculative features or broad "catch-all" tables.
