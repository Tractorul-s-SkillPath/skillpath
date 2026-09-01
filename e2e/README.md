# e2e

One journey, end to end, against a **separate Supabase project**: register →
baseline → results → plan.

```bash
npm run test:e2e          # build + start + run
npm run test:e2e:dev      # dev server instead, ~40s faster per iteration
```

## Why this exists when there are 365 unit tests

Three things in the product are load-bearing and cannot be reached from
`npm test`. This file is the only thing that touches them.

| Risk | Why nothing else catches it |
|---|---|
| `grade_assessment()` returns the wrong score | It is `SECURITY DEFINER` SQL holding the answer key. `grading.service.test.ts` asserts the RPC is *called*, never that it is *right* — the fake returns whatever it is told to. |
| The session cookie is not really verified | `middleware.ts` checks only that a cookie is present. A build where the HMAC is never compared passes every page load; only a forged cookie shows it. |
| The plan silently stops being written | `grading.service` catches a failed plan write and logs it on purpose, so the run stays graded. The caller sees HTTP 200 and a correct score. Only rendered rows can tell. |

## Setup, once

1. **A second Supabase project.** Not the one `.env.local` names —
   `e2e/helpers/env.ts` compares the two and refuses to run if they match.
2. **The schema in it.** Same tables, views, triggers and functions;
   `grade_assessment()` in particular, or the journey grades nothing. With no
   migrations in the repository (ARCHITECTURE §0) the two databases drift, so
   **run `e2e/schema-patch.sql` in the test project's SQL editor** — it carries
   the two differences a column-by-column diff of the two projects found, and
   explains each. `global-setup.ts` re-checks the important one before every run.
3. **`.env.e2e`** at the repository root — `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SESSION_SECRET`. Gitignored. The block at
   the bottom of `.env.example` is the template.
4. **Seed it:** `npm run seed:e2e`. The baseline paper is twenty questions and
   `startBaseline()` refuses a shorter one, so an unseeded project cannot open
   a run at all. `global-setup.ts` checks this before the browser starts and
   says so.

## How it runs

- **Its own port (3100), never reusing a running server.** A dev server on 3000
  is pointed at `.env.local`; reusing it would run the whole journey against
  the demo project with every guard still green.
- **The app is aimed by `webServer.env`**, not by a `.env` file. Real process
  environment beats every file Next loads, which ends the question of
  precedence rather than answering it.
- **One worker.** One database, and the baseline is one attempt per member.
- **A fresh identity per run** — unique email *and* unique name, because
  `loginAction` rejects a duplicate of either.
- **Rows are kept.** A run leaves its member and everything it wrote in place,
  so you can read a graded baseline in the table editor afterwards — the run
  prints the email as it starts. `E2E_CLEAN=1` removes them instead, which is
  what CI passes so a shared project does not gain a member per push.

## What one journey writes

| Table | |
|---|---|
| `users` | 1 — the member |
| `assessments` | 1 — category 0, `submitted`, `total_score 60.00` |
| `student_responses` | 20, each with an `is_correct` snapshot: 12 true, 8 false |
| `recommendation_plans` | 8 — `not_started`, priorities 1–3 |
| `category_progress` | 1 — written by a **trigger** |
| `xp_events` | the submission award — also a **trigger** |

The spec asserts the first four. The last two are worth an eye the first time:
they are the only trigger-written rows in the journey, and a hand-built database
that is missing a trigger looks exactly like one that has it until you check.

## Adding a journey

Keep them few and whole. A second spec is worth writing when it covers a path
this one cannot reach — the admin's question-bank round trip is the obvious
one — and not when it re-checks something a service test already pins. Every
step here costs a database round trip and a browser; the unit suite is where
detail belongs.
