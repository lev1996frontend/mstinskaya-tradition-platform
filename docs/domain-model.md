# Domain Model

## 1. Platform Overview

The Mstinskaya Tradition Platform is a digital ecosystem for the Mstinskaya Tradition community. It brings together education, rules and regulations, instructors and judges, clubs, tournaments, athletes, and equipment.

The platform is broader than tournament management. Tournament operations are an important part of the system, but they are only one domain within a larger ecosystem that also supports community learning, rule governance, athlete identity, judging education, and equipment guidance.

---

## 2. Main Business Domains

### Users and Identity

Entities:

- User
- Profile
- Role
- Permission
- UserRole

The platform is centered on the user as the identity of a community member. One person may have multiple roles. For example, the same person may be an athlete, instructor, judge, and organizer at the same time.

This means the domain should not assume a single fixed role field on the account. Instead, relationships between users and roles should be explicit and can change over time.

---

### Clubs

Entities:

- Club
- ClubMember

Clubs represent training organizations or community groups. A club can have many members, and users may have membership history that spans different periods or organizations.

The platform should treat club membership as part of a person's historical participation rather than as a single permanent attribute.

---

### Education

Entities:

- Course
- Module
- Lesson
- Video
- Document
- Test
- Certificate
- Progress

Education is a core value of the platform. Courses are structured learning paths that may include modules, lessons, videos, documents, and tests. Materials may be public or role-based depending on access level and user permissions.

The educational domain should support the progression of learning, completion evidence, and recognition where required.

---

### Rules and Regulations

Entities:

- RuleSet
- RuleVersion
- RuleSection
- Rule

Rules and regulations are a foundational domain because tournament and judging decisions depend on the exact official rules used at a given time.

Rules are versioned. A tournament must reference the exact rule version used for that event. Historical records must remain interpretable even if the rules change later.

---

### Media

Entities:

- Media
- Video
- Image
- Document

Media is a shared service used by multiple domains. The same media model may support courses, rules, tournaments, club content, and equipment information.

The platform must distinguish between media metadata and file storage, because media files are managed separately from the application data model.

---

### Equipment

Entities:

- ProductCategory
- Product
- ProductVariant
- Manufacturer
- Seller
- EquipmentRequirement

Equipment is part of the community ecosystem. Products may be grouped into categories, offered by sellers, and linked to rule requirements or compatibility guidance.

A rule may define equipment needs or constraints, and the platform may help connect those requirements with relevant products.

---

### Tournaments

Entities:

- Tournament
- TournamentCategory
- Stage
- Participant
- Fight
- Result

Tournaments are a major domain, but they are not the whole platform. A tournament references the relevant regulations, contains categories and stages, and records participants, fights, and results.

Participants are not the same as athlete records. They are historical tournament entries linked to the athlete identity in the context of a specific event.

---

### Judging

Entities:

- FightJudge
- JudgingPanel
- FightResult

Judging is performed physically according to the regulations of the Mstinskaya Tradition. The platform stores the judges, the judging panel, and the final decisions of fights.

The platform does not replace real-world judging with online scoring. It supports judge education, record keeping, and final result preservation. No score-event model should be introduced unless the official regulations explicitly require it.

---

### Ratings

Entities:

- AthleteRating
- RatingHistory

Ratings are calculated from tournament results and must remain independent from the tournament result record itself. The rating logic should be a separate business rule set so it can evolve without corrupting historical results.

---

## 3. Core Relationships

Describe relationships:

User -> Roles

A user may hold multiple roles over time or at the same time.

User -> Athlete

A user may have an athlete profile or athlete identity in the community.

User -> Instructor

A user may act as an instructor for education and methodology.

User -> Judge

A user may act as a judge according to official rules and accreditation.

User -> Club

A user may belong to clubs and maintain a membership history.

Tournament -> RuleVersion

A tournament is associated with the specific rule version used for that event.

Tournament -> Participants

A tournament includes participants as historical entries tied to specific competition context.

Participant -> Fight

A participant takes part in one or more fights within the tournament.

Fight -> Judges

A fight has one or more judges and may be associated with a judging panel.

Fight -> Result

Each fight ends with an official result that must be preserved.

Result -> Rating

Results contribute to athlete rating history when the rating system is active.

Course -> Lessons -> Media

Educational content is structured into lessons and materials.

Rules -> Equipment Requirements

The rules may define equipment needs or compatibility requirements.

---

## 4. Important Domain Rules

- Historical data must not change in a way that alters its meaning.
- Rules must be versioned.
- Users can have multiple roles.
- Tournament results must preserve history.
- Media storage is separate from metadata.
- Judging is not online scoring.

---

## 5. Open Questions

The following questions require confirmation from the official Mstinskaya Tradition regulations before the platform makes assumptions:

- number of judges;
- fight structure;
- weapon categories;
- victory conditions;
- penalties;
- tournament formats;
- rating system.

No answers should be invented. These items must be confirmed by the governing rules and regulations.

The real domain model is centered on four durable ideas:

- people are not limited to one role;
- rules are versioned and historical;
- tournaments are separate from education and equipment;
- judging and results must be grounded in official regulation rather than assumptions.

This makes the domain model stable, extensible, and aligned with the long-term needs of the Mstinskaya Tradition community.
