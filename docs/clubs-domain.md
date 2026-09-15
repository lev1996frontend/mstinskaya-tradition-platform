
# Clubs Domain

## Purpose

The Clubs domain represents schools, communities and organizations
that participate in Mstinskaya Tradition.

A club can contain:

- instructors;
- athletes;
- judges;
- administrators.

---

# Entities

## Club

Represents a training organization.

Fields:

id UUID PK

name

- required
- unique

description

- optional

country

city

logo_url

- optional

created_at

updated_at

---

## ClubMember

Represents membership of a user inside a club.

Relations:

User belongs to many clubs.

Club contains many users.

Fields:

id UUID PK

club_id FK

user_id FK

role

Possible values:

OWNER
INSTRUCTOR
MEMBER
JUDGE

joined_at

created_at

updated_at

---

# Rules

1. User can belong to multiple clubs.

Example:

User:
Alex

Clubs:

- Moscow School
- Historical Combat Federation

2. One club can have multiple instructors.
3. Club owner manages members.
4. Club deletion should not delete users.
5. Identity module changes should stay rare and deliberate. Two documented
   exceptions exist: `email_verified_at` on `User`, added for email
   verification at registration — see
   `docs/superpowers/specs/2026-09-14-email-verification-design.md` — and
   `AuthService.assign_role`/`identity_access.assign_role`, the write path
   the `role_requests` module uses to grant a role once a request is
   approved — see
   `docs/superpowers/specs/2026-09-15-role-requests-design.md`.

---

# Future extensions

Possible additions:

- club verification
- club ranking
- club achievements
- club events
- club documents
