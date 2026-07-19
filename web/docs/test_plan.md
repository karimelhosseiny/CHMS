# Test Plan — CHMS Web Prototype (React + Node + MongoDB)

## 1. Purpose and Scope

This document describes the verification & validation (V&V) approach for the
web CHMS prototype under `web/`. This is an independent, full-stack
re-implementation of the same five requirements verified by the original
Python prototype (`chms/`, see [../../docs/test_plan.md](../../docs/test_plan.md)),
built instead as a React frontend, an Express/Node.js backend, and a MongoDB
data store — with a JWT-authenticated Student/Admin role model:

1. Course registration constraints (duplicate enrollment, section capacity /
   waitlisting)
2. Maximum and minimum credit-hour limits (standing- and overload-aware)
3. Prerequisite validation
4. Scheduling consistency (per-student time-conflict checks, and catalog-wide
   room/instructor double-booking checks)
5. Correctness of student enrollment operations (register, drop, waitlist
   promotion, final registration validation)

The business rules are a deliberate 1:1 port of `chms/validators.py`,
`chms/registration.py`, and `chms/catalog.py` — see
`web/backend/src/validators/registrationRules.js`,
`web/backend/src/services/registrationService.js`, and
`web/backend/src/services/catalogService.js`.

**Out of scope**: the React UI itself is not covered by automated tests (no
Cypress/Playwright browser-driven suite) — verified manually instead (§6).
Authentication (JWT/bcrypt) is exercised by the integration suite but is not
subject to the black-box/white-box technique breakdown below, since it isn't
one of the 5 stated requirements. No MongoDB multi-document transactions are
used (single-node MongoDB, no replica set) — a documented scope limitation
acceptable for a prototype; concurrent double-booking races are not
guarded against.

## 2. Test Levels

| Level | Location | Targets |
|---|---|---|
| Unit (white-box) | `web/backend/tests/unit/` | Pure validator functions and Mongoose schema invariants, driven by reading the source |
| Black-box | `web/backend/tests/blackBox/` | The HTTP API, treated as a specification-driven black box (EP / BVA / decision table) |
| White-box | `web/backend/tests/whiteBox/` | `registrationService.js` / `catalogService.js` internals, driven by reading the control flow (statement / branch / basis-path) |
| Integration / acceptance | `web/backend/tests/integration/` | Full auth + register → drop → waitlist-promotion flows through the real API |
| Manual | React UI in a browser | End-user-facing behavior of the same rules through the actual pages |

## 3. Black-Box Techniques Used

See [black_box_design.md](black_box_design.md) for the full design tables.

- **Equivalence Partitioning (EP)** — `tests/blackBox/equivalencePartitioning.test.js`
- **Boundary Value Analysis (BVA)** — `tests/blackBox/boundaryValueAnalysis.test.js`
- **Decision Table Testing** — `tests/blackBox/decisionTable.test.js`

## 4. White-Box Techniques Used

See [white_box_design.md](white_box_design.md) for the control-flow analysis.

- **Statement Coverage** — `tests/whiteBox/statementCoverage.test.js`
- **Branch/Decision Coverage** — `tests/whiteBox/branchCoverage.test.js`
- **Basis Path Testing (cyclomatic complexity)** — `tests/whiteBox/basisPathCoverage.test.js`

## 5. Tools

- **Jest** — test runner and assertion library
- **Supertest** — HTTP-level black-box requests against the Express app
- **mongodb-memory-server** — an isolated, in-memory MongoDB instance per
  test run (no local MongoDB install needed to run the suite)
- **Jest's built-in V8 coverage provider** — statement/branch/function/line
  coverage, matching the bar the Python prototype's `pytest-cov` set

Run the full suite:
```
cd web/backend
npm test
```

Run with coverage:
```
npm run test:coverage
```
This writes an HTML report to `coverage/index.html`.

## 6. Coverage Results (last verified run)

| Module | Statement | Branch | Function | Line |
|---|---|---|---|---|
| `src/validators/registrationRules.js` | 100% | 100% | 100% | 100% |
| `src/validators/schedule.js` | 100% | 100% | 100% | 100% |
| `src/services/registrationService.js` | 100% | 100% | 100% | 100% |
| `src/services/catalogService.js` | 100% | 100% | 100% | 100% |

112 automated tests, all passing (unit + black-box + white-box + integration
combined).

**Manual UI verification**: with the backend and frontend dev servers
running against MongoDB, exercised via the browser: student signup/login,
listing the seeded catalog, a successful registration, a prerequisite
rejection, filling a section to capacity and observing waitlisting, a
schedule-conflict rejection, a drop that promotes a waitlisted student, the
finalize-registration check (both passing and failing), and the admin
schedule-consistency report (both a clean catalog and one with an injected
room conflict). See the project README for exact steps; behavior matched the
automated test expectations in every case exercised.

## 7. Traceability

See [requirements_traceability_matrix.md](requirements_traceability_matrix.md)
for the mapping from each of the 5 project requirements to the specific
service/validator function that implements it and the test cases that verify
it.
