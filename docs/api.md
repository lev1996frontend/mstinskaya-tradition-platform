# API Design

## Core principles

The API should be REST-oriented and versioned under /api/v1/.

The first version should prioritize clear resource boundaries and predictable semantics rather than overly generic endpoints.

## Recommended API groups

- /api/v1/auth
- /api/v1/users
- /api/v1/clubs
- /api/v1/courses
- /api/v1/lessons
- /api/v1/progress
- /api/v1/certificates
- /api/v1/rules
- /api/v1/media
- /api/v1/products
- /api/v1/orders
- /api/v1/tournaments
- /api/v1/participants
- /api/v1/fights
- /api/v1/results
- /api/v1/ratings

## Design conventions

- use resource-oriented URLs;
- prefer explicit nouns over generic verbs;
- keep read and write semantics predictable;
- validate input on the backend even when frontend validation exists;
- enforce authorization rules in the API layer and domain services.

## Authentication and authorization

The API should support:

- access tokens;
- refresh tokens;
- password hashing;
- email verification where required;
- account activation and deactivation.

Authorization should rely on roles and permissions, not only frontend route protection. Examples include:

- tournament.read
- tournament.create
- tournament.update
- tournament.manage_participants
- judging.read
- judging.manage
- education.read
- education.manage
- rules.read
- rules.manage
- products.read
- products.manage
- orders.create
- orders.manage

## Response and validation guidelines

- return consistent HTTP status codes;
- keep error payloads informative and structured;
- validate important business constraints on the backend;
- avoid leaking data to unauthorized users.

## Future API evolution

The initial API should stay focused on the early product phases:

1. authentication and users;
2. clubs and profiles;
3. content and rules;
4. tournaments and fight results;
5. equipment and orders.

That keeps the API stable while the domain model matures.
