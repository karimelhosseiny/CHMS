# Credit Hour Management System (CHMS)

A full-stack course registration web app — React (Vite) frontend, Express/Node.js
backend, MongoDB database, JWT-authenticated Student/Admin roles — built as the
software prototype for a Software Verification & Validation course project. It
implements and verifies:

- Course registration constraints (duplicate enrollment, capacity/waitlisting)
- Maximum/minimum credit-hour limits (standing- and overload-aware)
- Prerequisite validation
- Scheduling consistency (per-student conflicts, and catalog-wide room/instructor double-booking)
- Correctness of enrollment operations (register, drop, waitlist promotion, final registration validation)

The business rules in `web/backend/src/validators/` and `web/backend/src/services/`
are each implemented as a single small, pure function per rule, verified by an
automated suite of 112 Jest tests — black-box (Equivalence Partitioning,
Boundary Value Analysis, Decision Table Testing) and white-box (Statement,
Branch, and Basis-Path/cyclomatic complexity coverage) — achieving 100%
statement/branch/function/line coverage on the business-logic modules.

## Project layout

```
web/
  backend/
    src/
      models/          Mongoose schemas: User, Student, Course, Section, Enrollment
      constants/        credit-hour policy constants
      errors/            one error class per registration rule
      validators/        registrationRules.js (pure functions), schedule.js
      services/          registrationService.js, catalogService.js (orchestration)
      controllers/, routes/, middleware/   Express API layer
      scripts/seed.js     demo catalog (5 courses/5 sections) + 3 students + 1 admin
    tests/
      unit/               validator + Mongoose schema tests, no DB/API involved
      blackBox/           Equivalence Partitioning, Boundary Value Analysis, Decision Table
      whiteBox/           Statement, Branch, and Basis-Path coverage
      integration/        full auth + register/drop/waitlist scenarios via the API
  frontend/
    src/
      api/client.js       fetch wrapper + JWT handling
      context/            AuthContext
      pages/               Login, Register, StudentDashboard, CourseCatalog, AdminDashboard, ScheduleConsistencyReport
      components/          NavBar, CreditMeter, SectionRow
  docs/
    test_plan.md, black_box_design.md, white_box_design.md, requirements_traceability_matrix.md
render.yaml    Render deployment blueprint for the backend
submission/    course project deliverables (report, literature summary, presentation slides)
```

## Prerequisites

- Node.js 18+ and npm (that's it — see below for MongoDB)

## Step-by-step: running the whole project

You need **three things running at once**, in three separate terminals:
a MongoDB server, the backend API, and the frontend dev server.

### 1. Install dependencies (one-time)

```
cd web/backend
npm install

cd ../frontend
npm install
```

### 2. Start MongoDB (Terminal 1)

No separate MongoDB installation is required. `npm install` above already
pulled in a real `mongod` binary (via the `mongodb-memory-server` package,
normally used for tests) — a small wrapper script reuses that exact binary
to run a genuine, persistent local MongoDB server, so there's nothing extra
to download and nothing installed system-wide:

```
cd web/backend
npm run mongo
```

Leave this running. You should see:
```
MongoDB is running at: mongodb://127.0.0.1:27017/
Data persists in .mongo-data/ between restarts. Press Ctrl+C to stop.
```
Data is stored in `web/backend/.mongo-data/` and survives restarts — stop
with Ctrl+C and run `npm run mongo` again any time, your data will still be
there. The very first start can take a little while (initializing the data
directory); later starts are quick.

**Alternative**: if you'd rather have MongoDB always available in the
background as a normal Windows service, install **MongoDB Community
Server** yourself from https://www.mongodb.com/try/download/community (pick
"Install MongoDB as a Service" in the installer) — it listens on the same
`mongodb://localhost:27017` by default, so everything below works unchanged
either way. Docker (`docker run -d -p 27017:27017 mongo:6`) is another
option if you have Docker Desktop.

### 3. Start the backend (Terminal 2)

```
cd web/backend
cp .env.example .env      # defaults already point at mongodb://localhost:27017/chms
npm run seed               # seeds 5 courses, 5 sections, 3 students, 1 admin (safe to re-run — it clears and reseeds)
npm run dev                 # starts the API on http://localhost:4000
```

### 4. Start the frontend (Terminal 3)

```
cd web/frontend
npm run dev                 # starts the React app on http://localhost:5173
                             # (proxies /api requests to :4000, see vite.config.js)
```

### 5. Open the app

Go to **http://localhost:5173** in your browser. Log in with one of the
seeded demo accounts (password `password123` for all):

| Email | Role |
|---|---|
| s1@example.com | Student (Alice) |
| s2@example.com | Student (Bob, completed CS101) |
| s3@example.com | Student (Cara, on probation) |
| admin@example.com | Admin |

Or click "Register as a student" to create your own account.

**Try this golden path**: log in as `s1@example.com` → Course Catalog →
register for CS101-A → Dashboard (see credit meter update) → try CS201-A
(rejected: prerequisite) → try MATH101-A (rejected: schedule conflict with
CS101-A, same time slot) → back on Dashboard, click "Finalize Registration"
(rejected: below the 12-credit minimum with only 3 credits). Log in as
`admin@example.com` → Admin → create a course/section → Schedule
Consistency page to see the catalog-wide conflict check.

To stop everything: Ctrl+C in each of the three terminals.

## Running the automated tests

No MongoDB needs to be running for this — the test suite spins up its own
separate, temporary in-memory instance automatically:

```
cd web/backend
npm test                   # full suite (unit + black-box + white-box + integration)
npm run test:coverage      # same, plus a coverage report at coverage/index.html
```

Last verified run: **112 tests passing, 100% statement/branch/function/line
coverage** on `src/validators/` and `src/services/`. See
[web/docs/test_plan.md](web/docs/test_plan.md) for the full V&V writeup.

## Building the frontend for production

```
cd web/frontend
npm run build               # outputs to dist/
```

## Course project deliverables

The [submission/](submission/) folder contains the report, literature
summary, and presentation slides for the course project:
[CHMS_Project_Report.docx](submission/CHMS_Project_Report.docx),
[Literature_Summary.docx](submission/Literature_Summary.docx),
[CHMS_Presentation.pptx](submission/CHMS_Presentation.pptx).
