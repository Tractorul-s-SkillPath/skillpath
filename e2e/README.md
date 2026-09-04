# e2e

Two journeys, end to end, against a **separate Supabase project**:

- `baseline-journey.spec.ts` — one member: register → baseline → results → plan.
- `admin-question.spec.ts` — two roles: an admin writes a question, a student
  sits it, and the answer key does not travel.

```bash
npm run test:e2e          # build + start + run
npm run test:e2e:dev      # dev server instead, ~40s faster per iteration
```

## Why these exist when there are 365 unit tests

Five things in the product are load-bearing and cannot be reached from
`npm test`. These two files are the only thing that touches them.

| Risk                                                 | Why nothing else catches it                                                                                                                                                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grade_assessment()` returns the wrong score         | It is `SECURITY DEFINER` SQL holding the answer key. `grading.service.test.ts` asserts the RPC is _called_, never that it is _right_ — the fake returns whatever it is told to.                                  |
| The session cookie is not really verified            | `middleware.ts` checks only that a cookie is present. A build where the HMAC is never compared passes every page load; only a forged cookie shows it.                                                            |
| The plan silently stops being written                | `grading.service` catches a failed plan write and logs it on purpose, so the run stays graded. The caller sees HTTP 200 and a correct score. Only rendered rows can tell.                                        |
| An admin writes a question no student can be served  | `insertWithAnswers` never sets `status`; `listActiveIds` filters on it. Every unit test fakes one side of that pair, so only a real write followed by a real draw can see the two disagree.                      |
| The answer key leaves in a spelling nobody greps for | The repository boundary renames `is_correct` to `isCorrect`, and the results page derives a third name again (`correctAnswerId`). Unit tests pin each layer alone; neither runs both roles against one database. |

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
   says so. The seed is also where `admin@skillpath.test` comes from, and the
   admin journey has no way around it: `loginAction` refuses to register an
   administrator through the form (`?error=manager_approval_required`), which
   is the point — a signup form does not hand out accounts that can read the
   answer key.

## How it runs

- **Its own port (3100), never reusing a running server.** A dev server on 3000
  is pointed at `.env.local`; reusing it would run the whole journey against
  the demo project with every guard still green.
- **The app is aimed by `webServer.env`**, not by a `.env` file. Real process
  environment beats every file Next loads, which ends the question of
  precedence rather than answering it.
- **One worker.** One database, and the baseline is one attempt per member.
- **A fresh identity per run** — unique email _and_ unique name, because
  `loginAction` rejects a duplicate of either.
- **Rows are kept — by the baseline journey.** It leaves its member and
  everything it wrote in place, so you can read a graded baseline in the table
  editor afterwards; the run prints the email as it starts. `E2E_CLEAN=1`
  removes them instead, which is what CI passes so a shared project does not
  gain a member per push.
- **The admin journey is the other way round: it removes what it made, unless
  it FAILED.** A kept member is a row nobody sees. A kept _category_ is active,
  has a full bank, and shows up on every student's `/assessments` page — one
  more per run. So a green run cleans up and a red one does not, because
  deleting the rows a failure happened on deletes the evidence. `E2E_CLEAN=1`
  removes those too. The two halves go together either way: the student's
  assessment points at the category, so the member cannot be kept without
  pinning the category down with it.

## What one journey writes

| Table                  |                                                          |
| ---------------------- | -------------------------------------------------------- |
| `users`                | 1 — the member                                           |
| `assessments`          | 1 — category 0, `submitted`, `total_score 60.00`         |
| `student_responses`    | 20, each with an `is_correct` snapshot: 12 true, 8 false |
| `recommendation_plans` | 8 — `not_started`, priorities 1–3                        |
| `category_progress`    | 1 — written by a **trigger**                             |
| `xp_events`            | the submission award — also a **trigger**                |

The spec asserts the first four. The last two are worth an eye the first time:
they are the only trigger-written rows in the journey, and a hand-built database
that is missing a trigger looks exactly like one that has it until you check.

## Adding a journey

Keep them few and whole. A spec is worth writing when it covers a path the
others cannot reach, and not when it re-checks something a service test already
pins. Every step here costs a database round trip and a browser; the unit suite
is where detail belongs.

Two rules the admin journey had to learn the hard way, both worth reusing:

- **Pair every negative with a positive on the same bytes.** "The payload does
  not contain the answer key" is equally true of an error page, a login
  redirect and an empty string. It means something only next to an assertion
  that the payload _does_ contain the question and its options.
- **Do not draw at random.** A category run picks `CATEGORY_PAPER_SIZE`
  questions out of the bank, so a question added to a seeded category of ten is
  on the paper ten times out of eleven. The admin journey builds its own
  category at exactly `MIN_CATEGORY_QUESTIONS` instead, because a bank smaller
  than the paper is served whole, every time.
