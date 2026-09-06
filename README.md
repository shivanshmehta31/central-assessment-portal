# Central Assessment & Examination Portal

A centralized, secure online assessment platform built for institutional-scale examinations. The first
configured course is **Data Visualization Using Python**, but the underlying assessment engine is
subject-agnostic — new departments, courses, and subjects can be added without code changes.

> **Project status:** Phase 1 of a phased build (see [Roadmap](#roadmap) below). The full core exam
> loop — auth, question bank, assessment builder, server-authoritative timed exams with autosave and
> integrity monitoring, auto + manual evaluation, results publishing, and live admin monitoring — is
> implemented and tested end-to-end against a real PostgreSQL database. Sandboxed code execution for
> coding questions is **not** implemented yet; see [Known limitations](#known-limitations-phase-1).

## 1. Project Overview

Three portals, one backend:

- **Admin** — manages departments/courses/subjects, students, faculty, the question bank, assessment
  creation and scheduling, live exam monitoring, incident (violation) management, results publication,
  analytics, audit logs, and system settings.
- **Faculty** — evaluates assigned assessments: reviews manually-graded question types (descriptive,
  coding, short answer), awards marks and feedback, and finalizes attempt scores.
- **Student** — sees assigned assessments, reads instructions and passes a system check, takes the exam
  in a secure, monitored interface with a server-authoritative countdown timer and autosave, and views
  published results.

## 2. Features

- Role-based access control (Admin / Faculty / Student) enforced server-side on every route.
- 11 question types: MCQ, multiple-select, true/false, short answer, descriptive, coding, code
  completion, code debugging, code output prediction, dataset analysis, visualization interpretation.
- Assessment builder: question bank attachment, question/option randomization, per-student question
  subsets, device restriction, fullscreen requirement, configurable violation policy.
- Server-authoritative exam timer (deadline stored and enforced in the database; a background job
  auto-submits any attempt whose deadline has passed even if the browser tab is closed).
- Autosave on every answer change, with local resilience messaging when the connection drops.
- Exam integrity monitoring: Page Visibility (tab-switch), window blur, Fullscreen Exit, page
  refresh/navigation-attempt, and copy/paste detection, with a configurable policy (log-only / warn /
  auto-submit / terminate) and a full admin override workflow (ignore, remove, reset count, allow
  student to continue, reopen, reset attempt, grant extra time).
- Automatic evaluation for objective question types (MCQ, multiple-select, true/false, code output
  prediction) with per-question negative marking; manual evaluation workflow for the rest.
- Real-time (Socket.IO) push for live exam monitoring dashboards, violation alerts, forced submission,
  and time extensions — no client polling required for those events.
- Results: pending → evaluated → published → withheld lifecycle, topic-wise performance breakdown,
  CSV export, admin score override.
- Full audit log of logins, exam starts/submissions, violations, admin overrides, and evaluation
  actions.
- CSV/Excel bulk import for students; CSV import for MCQ-style questions.

## 3. Technology Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Backend | NestJS 10, TypeScript |
| Database | PostgreSQL 16+, accessed via Prisma ORM |
| Real-time | Socket.IO (`@nestjs/websockets`) |
| Auth | JWT access + refresh tokens, bcrypt password hashing |
| Code editor | Monaco Editor (`@monaco-editor/react`) |
| Charts | Recharts |

Redis is wired into the architecture (session/rate-limit/cache layer) but not yet load-bearing in
Phase 1 — see [Roadmap](#roadmap).

## 4. Project Structure

```
backend/
  prisma/schema.prisma      Full data model (Users, Students, Faculty, Questions, Assessments,
                             AttemptRecords, StudentAnswers, Violations, AuditLogs, ...)
  prisma/seed.ts             Demo data: institution, admin, faculty, 20 students, ~30 questions
                             covering all 5 Data Visualization syllabus units, one sample assessment
  src/
    auth/                    Login, refresh, forgot/reset password, JWT strategy
    academics/               Departments, courses, subjects
    students/ faculty/       CRUD, bulk import, credential management
    question-bank/           Question CRUD, CSV import, dataset upload
    assessments/             Assessment builder, exam control (start/pause/end/extend/terminate)
    attempts/                The exam-taking engine: start, save-answer, submit, auto-grading,
                             server-authoritative deadline enforcement (cron)
    violations/              Integrity violation reporting + admin incident management
    evaluation/              Faculty grading workflow
    results/                 Result publishing, topic analysis, CSV export
    analytics/               Dashboard KPIs, question/topic analytics, live monitoring feed
    realtime/                Socket.IO gateway
    audit-logs/ notifications/ settings/
  test/app.e2e-spec.ts       End-to-end test of the full golden path (see below)

frontend/
  src/app/
    admin/(portal)/          Admin Control Center — dashboard, students, faculty, academics,
                             question bank, assessments, live monitoring, incidents, results,
                             audit logs, settings
    faculty/(portal)/        Faculty dashboard + evaluation workflow
    student/(portal)/        Student dashboard, instructions, results
    student/exam/[id]/       The secure exam-taking interface (outside the normal portal shell)
  src/components/exam/       Question renderer (per-type), Monaco code editor wrapper
  src/hooks/                 Auth guard, integrity-monitoring hook
  src/lib/                   API client, auth store (Zustand), Socket.IO client, shared types
```

## 5. Installation

Requirements: Node.js 20+, PostgreSQL 16+ (a local instance or Docker), npm.

```bash
# Backend
cd backend
npm install
cp .env.example .env        # edit DATABASE_URL, JWT_SECRET, etc.
npx prisma migrate dev      # creates the schema
npm run seed                # loads demo data (see console output for login credentials)
npm run start:dev           # http://localhost:4000/api/v1

# Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env.local  # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL
npm run dev                 # http://localhost:3000
```

Or bring up the whole stack (Postgres + Redis + backend + frontend) with Docker:

```bash
docker compose up --build
```

## 6. Environment Variables

See `backend/.env.example` and `frontend/.env.example`. Key backend variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Signs access/refresh tokens — set a long random value in production |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend origins |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Credentials created by `npm run seed` |

Frontend:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the backend REST API (`.../api/v1`) |
| `NEXT_PUBLIC_WS_URL` | Base URL of the Socket.IO gateway |

## 7. Database Setup

```bash
cd backend
npx prisma migrate dev --name <description>   # create + apply a migration in development
npx prisma migrate deploy                     # apply migrations in production (no prompts)
npx prisma studio                             # optional: browse the database visually
```

## 8. Demo Accounts (after `npm run seed`)

| Role | Identifier | Password |
|---|---|---|
| Admin | `admin@institution.edu` | `Admin@12345` |
| Faculty | `faculty@institution.edu` | `Faculty@12345` |
| Student | `CSE2026001` … `CSE2026020` (Student ID) | `Student@12345` |

A sample assessment, **"Data Visualization Using Python – Assessment 1"**, is pre-created, published,
and assigned to all 20 seeded students, with ~30 questions spanning all five syllabus units and every
supported question type.

## 9. Running Tests

```bash
cd backend
npm test              # unit tests (auto-grading logic, seeded shuffle determinism)
npm run test:e2e       # full golden-path integration test against a real Postgres database:
                        # admin creates a department/course/subject/question/assessment, publishes
                        # it, a seeded student logs in, starts the exam, autosaves an answer, is
                        # flagged with a violation, submits, gets auto-graded, and the admin reviews
                        # + overrides the incident. All fixtures created are cleaned up afterward.
```

`test:e2e` needs `DATABASE_URL` pointing at a real, seeded Postgres database (it reads one seeded
student, `CSE2026005`, and does not touch the rest of the seed data).

## 10. Building for Production

```bash
cd backend && npm run build && npm run start:prod
cd frontend && npm run build && npm run start
```

## 11. Deployment Guide

`docker-compose.yml` at the repo root defines four services: `postgres`, `redis`, `backend`, and
`frontend`. `backend`'s container entrypoint runs `prisma migrate deploy` before starting the server,
so schema migrations apply automatically on deploy — run `npm run seed` manually afterward if you want
demo data in that environment.

For a from-scratch cloud deployment:

1. Provision a managed PostgreSQL instance (e.g., RDS, Cloud SQL) and a managed Redis instance.
2. Build and push the `backend` and `frontend` Docker images.
3. Set the environment variables from `backend/.env.example` / `frontend/.env.example` on your
   platform (never commit real secrets — `JWT_SECRET` especially).
4. Run `npx prisma migrate deploy` against the production database as part of your release step.
5. Put the backend behind HTTPS and restrict `CORS_ORIGIN` to your real frontend domain.
6. File storage (`backend/uploads`) is local-disk in this phase — mount a persistent volume, or swap
   `DatasetsService` for an S3/GCS-backed implementation before scaling beyond a single instance.

## 12. Security Considerations

- Passwords are hashed with bcrypt (cost factor 12); never stored or logged in plaintext (temporary
  passwords generated for new accounts are returned once, over HTTPS, to the admin who created the
  account).
- JWT access tokens are short-lived (15 min); refresh tokens are single-use, hashed at rest, and
  rotated on every refresh.
- All mutating endpoints are guarded by `JwtAuthGuard` + `RolesGuard`; ownership is additionally
  checked in service methods (e.g., a student can only act on their own attempt).
- `helmet()` sets standard security headers; `ThrottlerModule` rate-limits all API traffic.
- Input is validated with `class-validator` DTOs on every write endpoint; Prisma parameterizes all
  queries (no raw SQL / injection surface).
- The exam timer's source of truth is the server (`AttemptRecord.deadlineAt`), not the browser clock —
  a background job (`AttemptsScheduler`) auto-submits any attempt past its deadline every 10 seconds,
  so a client cannot extend their own time by manipulating local time or JavaScript state.
- **Realistic scope of browser-based integrity monitoring:** this system detects tab switches, window
  blur, fullscreen exit, and refresh/navigation attempts within the exam tab. It cannot, and does not
  claim to, prevent a student from using a second device, taking a screenshot, or using OS-level
  screen-sharing. For high-stakes examinations, pair this with an institution-managed lockdown browser
  (e.g., Safe Exam Browser) or in-person proctoring — this is called out explicitly in the exam
  instructions students see before starting.

## Known Limitations (Phase 1)

This was built as an explicitly-scoped first phase (see the in-conversation scoping decision):
sandboxed code execution for coding questions was intentionally deferred. Concretely:

- **No live code execution sandbox.** Coding, code-completion, and code-debugging questions render a
  full Monaco editor and capture the student's submitted code, but there is no Docker/gVisor-based
  execution service yet — "Run Code" tells the student this, and submitted code goes to faculty for
  manual evaluation instead of automatic test-case scoring. `TestCase` records are already modeled in
  the schema so an execution service can be added later without a data-model change.
- **Redis is configured but not yet used** for caching, session storage, or rate-limit backing beyond
  the in-memory default — fine at seed-data scale, worth revisiting before a 3,000–4,000-student
  rollout.
- **File storage is local disk** (`backend/uploads`), not yet backed by S3/GCS — fine for a single
  instance, not for horizontal scaling.
- **Notifications** are recorded in the database and readable via `/notifications`, but there is no
  email/push delivery channel yet (`forgot-password` similarly logs a reset link server-side instead
  of emailing it — wire in a transactional email provider before production use).
- Bulk report exports (attendance, faculty evaluation summary) beyond the results CSV are not yet
  built.

## Roadmap

Later phases, in rough priority order: Dockerized sandboxed code execution with hidden test cases and
inline chart rendering for visualization questions; Redis-backed sessions/rate-limiting/caching for
horizontal scale; S3-compatible object storage for datasets and uploads; transactional email for
notifications and password resets; deeper analytics (per-difficulty breakdowns, cohort comparisons);
Safe Exam Browser integration hooks; GenAI-assisted (human-reviewed) question generation and rubric
suggestions.
