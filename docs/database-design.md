# Database Design

## 1. Database Principles

The primary relational database for the platform is PostgreSQL. It should be the system of record for identity, rules, competitions, media metadata, and historical business records.

The domain data should be normalized so that each business concept has a clear and stable home. Repeated or derived values should not be duplicated across unrelated tables unless there is a specific historical or reporting need.

JSONB should be used only for genuinely flexible metadata that does not have a clear relational structure. It should not replace core domain tables for users, rules, tournaments, results, or athlete records.

Historical records must remain correct over time. This is especially important for rules, tournament outcomes, club membership history, ratings, and order pricing. Old data must not be overwritten in a way that changes its original meaning.

Large files, including videos, images, and documents, are stored outside the database in external object storage. PostgreSQL stores metadata such as file names, storage keys, access level, timestamps, and link relationships.

---

# 2. Identity Domain

## users

Fields:

- id
- email
- password_hash
- first_name
- last_name
- avatar_media_id
- status
- created_at
- updated_at

The users table stores the canonical identity of a person in the platform. It should contain authentication data and the basic account record, but not be used as the sole source of business roles.

Relationships:

- User has many roles.
- User may have one profile.
- User may have club membership history.
- User may have athlete data.

## roles

Fields:

- id
- code
- name

The roles table stores reusable business roles such as athlete, instructor, judge, organizer, or administrator. The code field should be stable and machine-readable, while name is the human-facing label.

## user_roles

Many-to-many relationship:
User <-> Role

The user_roles table links a user to one or more roles. This is necessary because a single person can hold multiple roles. A single role column on the users table would be too limited, because one user may be both an athlete and a judge, or an athlete and an organizer. Role assignment should therefore be modeled as a separate relationship table rather than a single polymorphic value.

---

# 3. Club Domain

## clubs

Fields:

- id
- name
- description
- city
- country
- logo_media_id

The clubs table stores club identity and profile information. It represents training organizations or community groups in the platform.

## club_members

The club_members table records the history of a user's membership in a club.

Fields:

- id
- user_id
- club_id
- role
- joined_at
- left_at

This table preserves membership history rather than only the current club assignment. A user may belong to multiple clubs over time, and historical records must remain visible and accurate.

---

# 4. Athlete Domain

## athletes

The athletes table stores athlete-specific profile data linked to a user.

Fields:

- id
- user_id
- biography
- birth_date
- gender
- country
- club_id
- created_at
- updated_at

The athlete record represents a person's athletic profile and identity, but it is not the same as tournament participation. Tournament participation is historical and event-specific, and should be modeled separately.

---

# 5. Education Domain

## courses

The courses table stores educational programs or learning paths.

Fields:

- id
- title
- description
- status
- created_at
- updated_at

## course_modules

This table stores logical groupings within a course.

Fields:

- id
- course_id
- title
- order_index

## lessons

The lessons table contains educational units.

Fields:

- id
- module_id
- title
- description
- content
- order_index
- created_at

## lesson_media

This table links lessons to media assets.

Fields:

- id
- lesson_id
- media_id
- relation_type

## course_progress

This table tracks learner progress at course level.

Fields:

- id
- user_id
- course_id
- status
- started_at
- completed_at

## lesson_progress

This table tracks learner progress at lesson level.

Fields:

- id
- user_id
- lesson_id
- status
- started_at
- completed_at

## certificates

This table stores official recognition or completion records.

Fields:

- id
- user_id
- course_id
- lesson_id
- certificate_number
- issued_at
- status

Course structure:

Course
-> Module
-> Lesson
-> Media

This structure supports progressive learning, resource attachment, and completion tracking while keeping the domain understandable and traceable.

---

# 6. Rules Domain

## rule_sets

The rule_sets table stores the top-level rule framework or governing ruleset.

Fields:

- id
- name
- description
- created_at

## rule_versions

This table stores published versions of a ruleset.

Fields:

- id
- rule_set_id
- version_label
- effective_from
- effective_to
- status
- created_at

Rules are immutable versions. Once a rule version is published, it should not be silently modified. Historical data must remain bound to the version that was active when the record was created.

## rule_sections

This table stores grouped sections or chapters within a rule version.

Fields:

- id
- rule_version_id
- title
- order_index

## rules

The rules table stores individual rule statements or requirements.

Fields:

- id
- rule_section_id
- code
- text
- order_index

Important:

- Rules are immutable versions.
- Tournament references a specific rule version.
- Historical results must remain interpretable even after new rule versions are published.

---

# 7. Media Domain

## media

Fields:

- id
- type
- storage_key
- filename
- mime_type
- size
- duration
- access_level
- created_at
- updated_at

The media table stores the file metadata required to access and manage uploaded assets. It should not contain large binary content.

Media is shared by:

- lessons;
- rules;
- tournaments;
- products;
- news.

The media domain supports reuse across multiple business domains using explicit links and access controls instead of duplicating storage logic in each domain.

---

# 8. Equipment Domain

## product_categories

The product_categories table stores high-level product grouping.

Fields:

- id
- name
- description

## products

The products table stores items in the equipment catalog.

Fields:

- id
- product_category_id
- name
- description
- manufacturer_id
- seller_id
- created_at

## product_variants

The product_variants table stores different versions or options of a product.

Fields:

- id
- product_id
- name
- sku
- price
- attributes

## manufacturers

This table stores manufacturers or brands.

Fields:

- id
- name
- country

## sellers

This table stores seller or distributor information.

Fields:

- id
- name
- contact_email
- website

## equipment_requirements

This table links product and rule information.

Fields:

- id
- rule_id
- product_id
- requirement_type
- description

Relationship:
Rule -> EquipmentRequirement -> Product

This allows the platform to show which products may match a rule requirement or compatibility condition.

---

# 9. Tournament Domain

## tournaments

Fields:

- id
- name
- description
- organizer_id
- rule_version_id
- start_date
- end_date
- status

The tournaments table stores the event and its general metadata, including the specific rule version used for the tournament.

## tournament_categories

This table stores categories inside a tournament such as:

- men;
- women;
- age categories;
- weapon categories.

Fields:

- id
- tournament_id
- name
- description

## participants

The participants table is a historical tournament registration record. It is not just an athlete table copy.

Fields:

- id
- athlete_id
- tournament_id
- category_id
- status
- registered_at

Important:
Participant is a historical tournament registration.
Relationship:
Athlete -> Participant -> Tournament

This preserves the distinction between athlete identity and event participation.

## stages

This table stores tournament stages such as:

- qualification;
- quarterfinal;
- semifinal;
- final.

Fields:

- id
- tournament_id
- name
- order_index
- status

## fights

The fights table stores matches or bouts within a tournament stage.

Fields:

- id
- stage_id
- participant_a_id
- participant_b_id
- status
- scheduled_at
- started_at
- ended_at

Fight contains:

- participant A;
- participant B;
- stage;
- status;
- timestamps.

---

# 10. Judging Domain

## fight_judges

This table connects fights to users acting as judges.

Fields:

- id
- fight_id
- user_id
- role

Relationship:
Fight <-> User

This records the judge assignment with the relevant judging role for that fight.

## fight_results

Fields:

- id
- fight_id
- winner_id
- result_type
- reason
- comment
- decided_at

This table stores the final decision after a fight. It preserves the official result and the reason or description that supports it.

Important:

- Do not create online scoring tables.
- The platform stores the final decision.

---

# 11. Rating Domain

## athlete_ratings

This table stores current athlete rating values.

Fields:

- id
- athlete_id
- rating_value
- updated_at

## rating_history

This table stores historical rating changes over time.

Fields:

- id
- athlete_id
- rating_value
- source_type
- source_id
- recorded_at

The rating calculation is separated from tournament logic. Tournament results are stored as historical facts, and rating calculations operate on those facts to generate current or historical rating states.

---

# 12. Order Domain

## orders

The orders table stores purchase requests or orders.

Fields:

- id
- user_id
- seller_id
- status
- created_at
- updated_at

## order_items

The order_items table stores the purchased items and preserves the purchase price at the time of purchase.

Fields:

- id
- order_id
- product_id
- product_variant_id
- quantity
- unit_price
- total_price

Important:
OrderItem stores historical price.

This is required so order totals remain accurate even if the product price later changes.

---

# 13. Relationship Summary

User
|

- Roles
  |
- Athlete
  |
- Club
  |
- Courses
  |
- Tournament Participation
  |
  Fight
  |
  Result
  |
  Rating

This summary shows the important data flow across the platform: identity activates roles and participation, participation flows into tournament events and results, and results feed into ratings.

---

# 14. Constraints

Important constraints should be enforced as part of the data model:

- unique email in the users table;
- unique role code in the roles table;
- tournament must have a valid rule version reference;
- fight cannot have the same participant twice in the same bout;
- order item must store price at time of purchase;
- historical records should not be overwritten;
- rule versions should remain immutable once published;
- a participant should belong to the correct tournament and category;
- fight results should be linked to an existing fight record;
- rating history should refer to a valid athlete and source record.

These constraints are business safeguards, not only technical checks.

---

# 15. Index Strategy

Indexes should be created only when they support real query patterns and business access patterns.

Examples:

- user lookup by email;
- tournament search by name, date, and status;
- athlete profiles by user or club;
- course content by course and module;
- media lookup by type, access level, and storage key;
- ratings by athlete and recorded date.

The goal is to support common reading patterns without creating unnecessary indexes on every table.

---

# 16. Future Extensions

Possible future additions include:

- judge accreditation;
- marketplace;
- tournament registration workflow;
- statistics;
- notifications;
- analytics.

These are useful future capabilities, but they should not be added to the initial MVP data model unless required by the actual product scope.
