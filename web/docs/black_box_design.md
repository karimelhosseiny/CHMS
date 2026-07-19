# Black-Box Test Design — CHMS Web Prototype

Black-box tests drive the HTTP API (via Supertest) as a specification —
inputs to endpoints, and the resulting status code / JSON body — with no
reference to the internal JavaScript control flow. See
[../../docs/black_box_design.md](../../docs/black_box_design.md) for the
original Python design these tables were ported from.

## 1. Equivalence Partitioning

Implemented in `web/backend/tests/blackBox/equivalencePartitioning.test.js`.

### `POST /api/enrollments` — credit limit (`checkCreditLimit`)

| Class | Standing | Overload approved | Max | Representative additional credits (active starts at 16) | Expected |
|---|---|---|---|---|---|
| 1 | GOOD_STANDING | No | 18 | +1 (→17) | 201 ENROLLED |
| 2 | GOOD_STANDING | No | 18 | +4 (→20) | 422 `CreditLimitExceededError` |
| 3 | PROBATION | (n/a) | 14 | +4 from 12 (→16) | 422 `CreditLimitExceededError` |

### `POST /api/enrollments` — prerequisites (`checkPrerequisites`)

| Class | Prerequisites | Completed | Expected |
|---|---|---|---|
| No prerequisites required | `[]` | `[]` | 201 success |
| All prerequisites met | `[CS101]` | `[CS101]` | 201 success |
| Prerequisite missing | `[CS101]` | `[]` | 422 `PrerequisiteNotMetError` |

### `POST /api/enrollments` — duplicate enrollment

| Class | Scenario | Expected |
|---|---|---|
| Valid | First-time registration | 201 success |
| Invalid | Same section registered twice | 409 `DuplicateEnrollmentError` |

### `GET /api/admin/schedule-consistency` — catalog consistency

| Class | Scenario | Expected |
|---|---|---|
| Valid | No sections share a room/instructor at overlapping times | `consistent: true`, empty `issues` |
| Invalid | Two sections share a room and instructor at overlapping times | `consistent: false`, `issues` contains both a `room` and an `instructor` entry |

### `POST /api/enrollments` / `DELETE /api/enrollments/:sectionId` — capacity & waitlist

| Class | Scenario | Expected |
|---|---|---|
| Valid | Section has an open seat | 201 ENROLLED |
| Edge (full, waitlist allowed) | Section at capacity, `allowWaitlist: true` | 201 WAITLISTED |
| Invalid | Section at capacity, `allowWaitlist: false` | 409 `SectionFullError` |
| Valid | Drop an active seat with someone waitlisted | Waitlisted student promoted to ENROLLED |
| Invalid | Drop a section never registered for | 404 `NotEnrolledError` |

### `POST /api/students/me/finalize` — minimum credits

| Class | Active credits | Expected |
|---|---|---|
| Valid | ≥ 12 | 200 `{ ok: true }` |
| Invalid | < 12 | 422 `BelowMinimumCreditsError` |

## 2. Boundary Value Analysis

Implemented in `web/backend/tests/blackBox/boundaryValueAnalysis.test.js`.
Every policy constant is tested at n-1, n, n+1:

| Constant | n-1 | n | n+1 |
|---|---|---|---|
| `MIN_CREDITS_FULL_TIME` = 12 | 11 → invalid (below min) | 12 → valid | 13 → valid |
| `MAX_CREDITS_STANDARD` = 18 | 17 → valid | 18 → valid | 19 → invalid |
| Section capacity (1 seat) | 0 seats available → waitlists | 1 seat available → enrolls | n/a |
| Prerequisite set | all-but-one satisfied → invalid | all satisfied → valid | n/a |
| Schedule overlap | touching slots (10:15 end = 10:15 start) → no conflict | 1-minute overlap (10:14 start before 10:15 end) → conflict | n/a |

## 3. Decision Table — `POST /api/enrollments` (register)

Five conditions, tested in the precedence order the code actually applies
them — later conditions are irrelevant ("-") once an earlier one determines
the outcome. Implemented 1:1 as Row 1..Row 7 in
`web/backend/tests/blackBox/decisionTable.test.js` (the duplicate-enrollment
short-circuit is Row 0, covered separately in the EP suite):

| Row | Section full? | Waitlist allowed? | Prereqs met? | Credit limit ok? | Schedule conflict-free? | Outcome |
|---|---|---|---|---|---|---|
| 1 | No | - | Yes | Yes | Yes | ENROLLED (201) |
| 2 | No | - | No | - | - | `PrerequisiteNotMetError` (422) |
| 3 | No | - | Yes | No | - | `CreditLimitExceededError` (422) |
| 4 | No | - | Yes | Yes | No | `ScheduleConflictError` (409) |
| 5 | Yes | Yes | Yes | - (not checked) | - (not checked) | WAITLISTED (201) |
| 6 | Yes | Yes | No | - | - | `PrerequisiteNotMetError` (422) |
| 7 | Yes | No | - (not checked) | - | - | `SectionFullError` (409) |

Row 5 is deliberately counter-intuitive and explicitly tested: a waitlisted
seat isn't consumed, so credit-limit and schedule-conflict are **not**
re-checked until the seat is actually offered at promotion time (see
`promoteFromWaitlist` in [white_box_design.md](white_box_design.md)).
