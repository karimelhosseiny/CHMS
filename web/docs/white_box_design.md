# White-Box Test Design — CHMS Web Prototype

White-box tests are derived by reading the control flow of
`web/backend/src/services/registrationService.js` and
`web/backend/src/services/catalogService.js` (and the pure functions in
`src/validators/`), not just their documented behavior. See
[../../docs/white_box_design.md](../../docs/white_box_design.md) for the
original Python control-flow analysis this was ported from.

## 1. Statement & Branch Coverage

`tests/whiteBox/statementCoverage.test.js` and `branchCoverage.test.js` were
written by walking every `if`/`while`/`try` in `registrationRules.js`,
`schedule.js`, `registrationService.js`, and `catalogService.js` and
constructing an input that forces each side of each decision at least once
(both branches of every `if`, a taken and a skipped iteration of the
`promoteFromWaitlist` loop, both the `try` body succeeding and its `catch`
firing — including the `err instanceof RegistrationError` re-throw guard,
forced via a mocked infrastructure failure since it can't be reached through
normal business inputs).

Confirmed by:
```
npm run test:coverage
```
Result (last run): **100% statement, 100% branch, 100% function, 100% line**
coverage on `src/validators/registrationRules.js`, `src/validators/schedule.js`,
`src/services/registrationService.js`, and `src/services/catalogService.js`.

## 2. Basis Path Testing — `register()`

Control-flow graph (each `check*` call is a node with two outgoing edges:
"passes" and "throws", since a thrown error is a control-flow exit just like
a `return`):

```
N1  entry: fetch student/section/course, checkDuplicateEnrollment()
      --(throws)--> Exit(DuplicateEnrollmentError)                          [edge e1]
      --(passes)--> N2
N2  if (roster.length >= capacity):
      --(True)--> N3
      --(False)--> N5
N3  if (!allowWaitlist):
      --(True)--> Exit(SectionFullError)                                    [edge e2]
      --(False)--> N4
N4  checkPrerequisites()
      --(throws)--> Exit(PrerequisiteNotMetError)                           [edge e3]
      --(passes)--> Exit(WAITLISTED, success)                               [edge e4]
N5  checkPrerequisites()
      --(throws)--> Exit(PrerequisiteNotMetError)                           [edge e5]
      --(passes)--> N6
N6  checkCreditLimit()
      --(throws)--> Exit(CreditLimitExceededError)                          [edge e6]
      --(passes)--> N7
N7  checkScheduleConflict()
      --(throws)--> Exit(ScheduleConflictError)                             [edge e7]
      --(passes)--> Exit(ENROLLED, success)                                 [edge e8]
```

7 binary decision nodes → V(G) = (number of binary decisions) + 1 = **8**.
The 8 basis paths are implemented in `tests/whiteBox/basisPathCoverage.test.js`:

| Path | Route | Test |
|---|---|---|
| 0 | N1 --e1--> Exit(Duplicate) | `Path 0: duplicate-enrollment exit ...` |
| 1 | N1→N2(F)→N5→N6→N7 --e8--> Exit(Enrolled) | `Path 1: not full, all rules pass` |
| 2 | N1→N2(F)→N5 --e5--> Exit(Prereq) | `Path 2: not full, prerequisites fail` |
| 3 | N1→N2(F)→N5→N6 --e6--> Exit(CreditLimit) | `Path 3: ... credit limit fails` |
| 4 | N1→N2(F)→N5→N6→N7 --e7--> Exit(ScheduleConflict) | `Path 4: ... schedule conflict fails` |
| 5 | N1→N2(T)→N3(F)→N4 --e4--> Exit(Waitlisted) | `Path 5: full, waitlist allowed, prerequisites pass` |
| 6 | N1→N2(T)→N3(F)→N4 --e3--> Exit(Prereq) | `Path 6: full, waitlist allowed, prerequisites fail` |
| 7 | N1→N2(T)→N3(T) --e2--> Exit(Full) | `Path 7: full, waitlist declined` |

**This basis-path set is identical to the black-box decision table** (Row
1..Row 7 in [black_box_design.md](black_box_design.md)) — the same
convergence noted in the Python prototype's docs, and for the same reason:
`register()`'s branching directly encodes the business-rule precedence order
with no extra hidden logic.

## 3. Basis Path Testing — `drop()` + `promoteFromWaitlist()`

This pair has a loop (`while waitlist.length > 0 && roster.length < capacity`)
with an early `continue` (skip an ineligible/orphaned candidate) and an early
`break` (promote, then stop — only one seat opened). Rather than force a
single mechanical V(G) through the compound loop condition, the basis set
below covers every loop-boundary case (0 iterations, 1 iteration ending in
promotion, 1 iteration ending in a skip with nobody left, N iterations with
repeated skips) crossed with every early-exit decision:

```
drop():
  enrollment missing/DROPPED? --(yes)--> Exit(NotEnrolledError)             [D1]
                               --(no)--> remove from roster/waitlist
  wasActiveSeat? --(no)--> return (no promotion attempted)                  [D6]
                 --(yes)--> promoteFromWaitlist(section)

promoteFromWaitlist() loop:
  0 iterations (waitlist already empty)                                     [D2]
  candidate doc missing (orphaned id) --> shift, continue                   [D3]
  candidate ineligible (checkCreditLimit/checkScheduleConflict throws)
    --> shift, delete Enrollment doc, continue; repeat for N candidates,
        then an eligible candidate is promoted, break                      [D4]
  candidate eligible immediately --> promote, break                        [D5]
  non-RegistrationError during eligibility check --> propagates, not
    swallowed as a skip (defensive branch, forced via a mocked failure)     [D7]
```

| Path | Description | Test |
|---|---|---|
| D1 | Drop a section the student has no record for | `Row/branch: enrollment missing or already dropped` |
| D2 | Active seat dropped, waitlist already empty (0 loop iterations) | `0 iterations: empty waitlist` |
| D3 | Active seat dropped, sole waitlisted id has no matching Student | `candidate document missing` (TRUE branch) |
| D4 | Two ineligible candidates skipped, third promoted | `2+ iterations: two ineligible candidates are skipped ...` |
| D5 | Active seat dropped, sole waitlisted candidate promoted immediately | `1 iteration, promote` |
| D6 | A *waitlisted* (not active) enrollment is dropped — no promotion attempted | `branch \`wasActiveSeat\`` (FALSE branch) |
| D7 | An unexpected (non-`RegistrationError`) failure during the eligibility check propagates instead of being treated as a skip | `err instanceof RegistrationError` (TRUE branch, mocked) |

## 4. Reading the coverage report

`npm run test:coverage` writes an HTML report to `coverage/index.html` (V8
coverage provider). Every line of `registrationRules.js`, `schedule.js`,
`registrationService.js`, and `catalogService.js` should show green
(statement hit) with no partially-covered branch arrows. Controllers,
routes, and middleware are exercised indirectly by the black-box/integration
suites but are not held to the same 100%-coverage bar, since they contain no
business logic of their own (thin request/response plumbing) — the same
distinction the Python prototype draws for `chms/cli.py`.
