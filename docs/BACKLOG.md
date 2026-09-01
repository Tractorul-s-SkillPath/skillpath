# SkillPath — Epics & Stories

Companion to [`ARCHITECTURE.md`](ARCHITECTURE.md). Bring both to the mentor check-in.

Part 1 is how we write stories, Part 2 is the backlog as planned, and
**[Part 3](#part-3--where-every-story-actually-stands) is where each story
stands against the code** — checked 27 August 2026.

---

## Part 1 — How we write these

### The shape

**Epic** = a capability a stakeholder would name out loud ("the question bank"). It is never
finished in one PR and it is never "the database layer" — epics are cut by *user value*, not by
technical layer.

**Story** = one vertical slice through every layer (page → action → service → domain → repository →
migration) that a user can *see working*. If a story leaves the app in a state where nothing new is
demonstrable, it is a task, not a story — fold it into the story that needs it.

**Acceptance Criteria** = Given / When / Then. Written *before* the code, testable by someone who
did not write it. If you cannot phrase an AC as a test, the story is still too vague.

### The INVEST check — run it on every story before you accept it into a sprint

| | |
|---|---|
| **I**ndependent | Can it be built without waiting on another in-flight story? |
| **N**egotiable | Does it describe the *outcome*, leaving the implementation open? |
| **V**aluable | Could you demo it to a mentor in 30 seconds? |
| **E**stimable | Does the team understand it well enough to size it? |
| **S**mall | Two days of work maximum. Longer → split it |
| **T**estable | Every AC is a pass/fail assertion |

### How to split a story that's too big

In order of preference: **by workflow step** (create → list → edit → delete), **by rule**
(happy path first, edge cases as follow-ups), **by role** (student view before admin view),
**by data variation** (one category before many). Never split by layer — "build the API" and "build
the UI" are two halves of a thing you cannot demo.

### Sizing

Fibonacci, relative, not hours. `1` = a form field or a filter. `2` = a simple CRUD page.
`3` = a page with real logic. `5` = touches three layers plus a migration. Anything you want to call
`8` is two stories you haven't split yet.

Rough capacity: 3 people × 3 build weeks. The backlog below totals **≈150 points**; treat
~15 pts/person/week as the planning assumption and re-check it at the end of Week 3 with your real
velocity, not this guess.

### Definition of Done — the same for every story, non-negotiable

- [ ] Merged to `main` via PR, one approval from someone who didn't write it, CI green
- [ ] Every input validated with Zod in the Server Action
- [ ] RLS policy exists for any new table access path, and is exercised by a test
- [ ] Unit tests for new `lib/domain` / `lib/services` logic; coverage gate still passing
- [ ] No `any`, no unexplained lint suppressions, typecheck clean
- [ ] Works on the Vercel preview URL, not just localhost
- [ ] `docs/` updated if an architectural decision changed

> **Four of these seven cannot be satisfied today**, and have not been for any
> story shipped so far: there is no CI, no RLS, no test runner and no ESLint
> config. Every story in Part 3 marked "done" is done against the other three.
> That is worth knowing before reading a tick as a guarantee — and it is the
> reason SP-003, SP-004 and SP-005 are worth more than their three points each.

### Putting it in GitHub

Use **GitHub Issues + a Projects board** (Todo / In Progress / In Review / Done). One issue per
story, title = the story line, body = AC as a checklist.

Labels: `epic:auth` `epic:questions` … · `type:story|bug|chore` · `size:1|2|3|5` ·
`owner:A|B|C` · `ai` · `blocked`

Create the first batch quickly:

```bash
gh issue create --title "SP-011 Student can register and is created as a student profile" \
  --label "epic:auth,type:story,size:3,owner:A" \
  --body "$(cat <<'EOF'
**As a** visitor **I want** to register **so that** I can take assessments.

- [ ] Given valid details, When I submit, Then an auth user and a profiles row exist with role=student
- [ ] Given an existing email, When I submit, Then I see a field-level error and no row is created
- [ ] Given a weak password, When I submit, Then the form rejects it client- and server-side
EOF
)"
```

Link stories to their epic with a task list in the epic issue, so closing stories ticks the epic.

### Cadence

Weekly planning (Mon), daily sync with mentors, refinement mid-week for next week's stories.
Nobody starts a story that hasn't got AC written.

---

## Part 2 — The backlog

Owners: **A** = auth/profile/plan/progress · **B** = admin/catalog/questions · **C** = assessments/scoring.
Assign real names before the check-in.

---

### EPIC 0 — Foundation & Delivery Pipeline
*Nothing else starts until SP-006 is merged.*

**SP-001 · Repo, Next.js app, Tailwind, strict TS** — `3` · all
- Given a fresh clone, When I run `npm i && npm run dev`, Then the app boots with no type errors
- `tsconfig` has `strict: true`; `any` fails lint
- `.env.example` committed with every key, all values empty

**SP-002 · Supabase project + three clients** — `3` · all
- `lib/supabase/server.ts`, `client.ts`, `admin.ts` exist; `admin.ts` imports `server-only`
- Given the service-role key is imported into a client component, When I build, Then the build fails

**SP-003 · Migration 0001 — schema** — `5` · all
- All 8 tables, 6 enums, and every constraint from §4.4 of the architecture spec apply cleanly
- Given a question with two correct answers, When inserted, Then the unique index rejects it
- Given a submitted assessment with null score, When inserted, Then the check constraint rejects it

**SP-004 · Migration 0002 — RLS + `answer_options` view** — `5` · all
- RLS enabled on every table in `public`
- Given a student's anon token, When I `GET /rest/v1/answers?select=is_correct`, Then it returns 401/empty
- Given the same token, When I query `answer_options`, Then I get `answer_text` with no `is_correct`
- Given student X's token, When I query student Y's assessments, Then I get zero rows

**SP-005 · CI pipeline** — `3` · all
- GitHub Action runs typecheck → lint → `vitest --coverage` → `next build` on every PR
- Given coverage below the threshold, When CI runs, Then the PR is blocked
- `main` is protected: one approval required

**SP-006 · TRACER BULLET: seed → take → score → screen** — `5` · all, paired
- One seeded category, one seeded question with 4 answers
- Given a logged-in student, When they open the assessment page, answer, and submit,
  Then a score is computed **server-side** and rendered
- Touches all five layers and both migrations; UI may be ugly
- Deployed and clicked-through on the Vercel preview URL

---

### EPIC 1 — Authentication & Roles · *owner A*

**SP-010 · Login / logout** — `3`
- Given valid credentials, When I log in, Then I land on the student dashboard
- Given wrong credentials, When I log in, Then I see one generic error (never "no such user")
- Given I log out, When I press Back, Then I am not shown cached protected content

**SP-011 · Registration creates a student profile** — `3`
- Given valid details, When I register, Then an `auth.users` row and a `profiles` row with
  `role='student'` exist, created by the trigger
- Given a duplicate email, When I submit, Then a field-level error appears and no row is created
- First/last name from the form reach `raw_user_meta_data` and land in the profile

**SP-012 · Route protection by role** — `3`
- Given an anonymous visitor, When they open `/dashboard`, Then they are redirected to `/login`
- Given a student, When they open `/admin`, Then they get 403 — **and** the underlying query would
  fail on RLS even if the redirect were removed
- Given an admin, When they open `/admin`, Then it renders

**SP-013 · Role escalation is impossible** — `2`
- Given a student, When they PATCH their own `profiles` row with `role='admin'`,
  Then the trigger silently keeps `role='student'`
- A test asserts this directly against the database

**SP-014 · Deactivated users are locked out** — `2`
- Given `status='inactive'`, When the user logs in, Then they see "account disabled" and reach no
  protected page; `is_admin()` returns false for an inactive admin

**SP-015 · Seed an admin account** — `1`
- Documented, repeatable way to promote a user to admin for the demo (script or SQL snippet in README)

---

### EPIC 2 — User Profile · *owner A*

**SP-020 · View my profile** — `2`
- Shows name, email, role, estimated level per category, and areas of interest
- Given no assessments yet, When I open it, Then I see an empty state, not an error

**SP-021 · Edit name and areas of interest** — `3`
- Given I change my name, When I save, Then it persists and the header updates
- `role`, `status` and `email` are not editable from this form
- Interests are chosen from the active category catalog

**SP-022 · Learning objectives** — `2`
- Free-text objective, max length enforced by Zod on both sides, persisted, shown on the profile

**SP-023 · Assessment history** — `3`
- Given past assessments, When I open my profile, Then I see date, category, score and level,
  newest first, each linking to its results page
- Given none, Then I see an empty state with a link to start one

---

### EPIC 3 — Catalog & Question Bank · *owner B*

**SP-030 · Admin lists categories** — `2`
- Paginated table: name, description, question count, status

**SP-031 · Admin creates / edits a category** — `3`
- Name is unique and 2–60 chars, enforced by Zod *and* the DB constraint
- Given a duplicate name, When I save, Then I get a field error, not a 500

**SP-032 · Admin deactivates a category** — `2`
- Deactivating hides it from students' pickers but preserves existing assessments
- Given a category with questions, When I try to hard-delete, Then it is refused (`on delete restrict`)

**SP-033 · Admin lists questions** — `3`
- Columns: text, category, difficulty, status, source (`manual`/`ai`)
- Server-side pagination

**SP-034 · Admin creates a question with answers** — `5`
- 2–6 answer options, exactly one marked correct, enforced in Zod and by the partial unique index
- Given zero correct answers, When I save, Then a form-level error appears
- Category and difficulty are required; the question is created `status='inactive'` by default

**SP-035 · Admin edits a question** — `3`
- Editing text or answers does not change already-submitted responses' `is_correct` snapshots
  *(this is the D4 guarantee — write the test)*

**SP-036 · Admin activates / deactivates a question** — `2`
- Only `active` questions are eligible for generation
- Given a question with no correct answer, When I try to activate it, Then it is refused

**SP-037 · Question-bank writes go through the service role** — `3`
- All reads/writes of `answers` happen server-side behind `assertAdmin()`
- Given a student calls the admin Server Action directly, Then it returns 403 and writes nothing

**SP-038 · Answers are never leaked to the browser** — `2`
- Given a student on the assessment page, When I inspect the network payload and the RSC stream,
  Then `is_correct` appears nowhere

---

### EPIC 4 — Assessment Generation, Run & Submission · *owner C*

**SP-040 · Student picks category + level** — `3`
- Only active categories with ≥1 eligible question are selectable
- Level defaults to the student's `current_level` for that category

**SP-041 · Generate the question set** — `5`
- Given a category and level, When I start, Then an `assessments` row (`in_progress`) plus one
  `student_responses` row per question (null answer, sequential `position`) are created in one transaction
- Question count is a single constant, documented
- Given fewer questions exist than requested, Then it generates what exists and warns, or refuses
  below a documented minimum

**SP-042 · Duplicate runs are impossible** — `3`
- Given an in-progress assessment for that category, When I start another,
  Then I am redirected into the existing one (the partial unique index is the backstop)

**SP-043 · Answer questions** — `5`
- Selecting an option persists `selected_answer_id` and `answered_at` immediately
- Progress indicator shows answered / total

**SP-044 · Refresh-safe resume** — `3` · *explicit brief requirement*
- Given I answered 3 of 10, When I hard-refresh, Then the same questions in the same order reload
  with my 3 answers still selected
- Nothing is stored in `localStorage`

**SP-045 · Timer** — `3`
- Countdown visible; on expiry the assessment auto-submits with the answers given
- Server recomputes elapsed time from `started_at` — a client with a frozen timer gains nothing

**SP-046 · Submit** — `5`
- Given unanswered questions, When I submit, Then I get a confirmation prompt naming the count
- On submit: score computed server-side, `is_correct` written per response, status → `submitted`,
  `submitted_at` set, redirect to results
- Given I resubmit the same assessment, Then it is rejected — no double scoring

**SP-047 · Abandon an assessment** — `2`
- Status → `abandoned`, freeing the category for a new run; abandoned runs are excluded from stats

**SP-048 · Multi-category run (stretch)** — `5`
- Selecting N categories creates N assessments sharing one `session_id`; results group by session
- *Cut this first if Week 5 is tight*

---

### EPIC 5 — Scoring & Results · *owner C*

**SP-050 · Scoring is pure and tested** — `3`
- `scoreAssessment` is a pure function in `lib/domain`, tested table-driven with no mocks
- All-correct → 100, none → 0, unanswered counts as incorrect

**SP-051 · Level estimation** — `3`
- `estimateLevel` implements the documented thresholds from one constants file
- Boundary cases (49.9 / 50 / 79.9 / 80) each have a test

**SP-052 · Weak-area identification** — `2`
- `identifyWeakAreas` returns categories below the threshold, ordered worst-first

**SP-053 · Results page** — `5`
- Shows total score, per-category score, estimated level, weak areas, and a per-question review
  (your answer, the correct one, correct/incorrect)
- Given another student's assessment id, When I open it, Then I get 404 — enforced by RLS, not by an `if`

**SP-054 · Category progress updates on submit** — `3`
- `category_progress` upserted with `current_level` and `last_score`
- Given a second assessment in the same category, Then the row updates rather than duplicating

**SP-055 · Score is never computed client-side** — `2`
- A test asserts the submit payload contains only `selected_answer_id`s, and that a forged
  `total_score` in the request body is ignored

---

### EPIC 6 — Learning Plan Recommendation · *owner A*

**SP-060 · Rule-based plan generation** — `5`
- `buildPlan` is pure and deterministic: weak areas + level → prioritised topics with
  `rule_description` and `priority` 1–5
- Given identical results, When run twice, Then the plan is identical

**SP-061 · Plan persisted on submit** — `3`
- Rows written to `recommendation_plans` linked to the triggering `assessment_id`
- Re-running the same category updates rather than duplicating (the unique constraint holds)

**SP-062 · Plan page** — `3`
- Grouped by category, ordered by priority; each item shows title, description and status

**SP-063 · Update item status** — `3`
- Not started → in progress → completed, persisted immediately
- Given a student tries to update another student's item, Then RLS rejects it
- Given a student tries to change `topic_title` or `priority`, Then only `progress_status` is written

**SP-064 · Empty and strong-performer states** — `2`
- Given no weak areas, Then the plan shows a "you're solid here, try the next level" state, not a blank page

**SP-065 · Plan reflects only the latest assessment** — `2`
- Documented rule for supersession, with a test

---

### EPIC 7 — Progress Tracking · *owner A*

**SP-070 · Student dashboard** — `3`
- Per category: current level, latest score, plan items completed / total

**SP-071 · Score trend over time** — `3`
- Given ≥2 assessments in a category, Then a simple chart shows the trend
- Given 1, Then a single point with a "take another to see progress" hint

**SP-072 · Overall completion** — `2`
- Percentage of plan items completed, across all categories

**SP-073 · First-run empty state** — `1`
- A brand-new student sees a clear call to action, never a broken layout

---

### EPIC 8 — Admin Dashboard, Search & Filtering · *owner B*

**SP-080 · Admin overview tiles** — `3`
- Total users, assessments completed, average score, most common weak category

**SP-081 · Aggregated weak categories** — `3`
- Ranked chart of weak categories across all students, computed server-side with one SQL aggregate,
  not by pulling every row into JS

**SP-082 · All results list** — `3`
- Student, category, score, level, date; sortable; server-side pagination

**SP-083 · User management list** — `3`
- Search by name/email, filter by role and status; admin can toggle a user's status

**SP-084 · Question search & filtering** — `3`
- Free-text on question text, filters for category / difficulty / status / source, combinable
- Filter state lives in the URL so it survives refresh and can be shared

**SP-085 · Category & results filtering** — `2`
- Same URL-state pattern applied to the category and results tables

**SP-086 · Search performance** — `2`
- Filtering happens in Postgres with the indexes from migration 0001, verified with `EXPLAIN`
- No endpoint returns an unbounded result set

---

### EPIC 9 — AI Features · *one story each — this is the graded differentiator*

**SP-090 · Provider abstraction + mock** — `3` · all
- `AiProvider` interface with `mock` and `anthropic` implementations, chosen by `AI_PROVIDER`
- `mock` is the default in tests and CI and returns deterministic fixtures
- Given the provider throws or times out (10s), Then the caller degrades gracefully and logs

**SP-091 · AI Study Recommendation Enhancer** — `5` · C
- Given a submitted assessment, When the plan is generated, Then each item gets an `ai_description`
  explaining *why* it matters for this student's specific results
- The rule-based plan renders first; AI text is stored, never regenerated per page view
- Given the provider fails, Then the page still shows the full rule-based plan with no error banner
- Output parsed with Zod before it touches the database

**SP-092 · AI Question Generator** — `5` · B
- Given a category, difficulty and count, When an admin generates, Then draft questions with options
  and a marked correct answer appear for review
- Drafts are inserted `status='inactive'`, `source='ai'` — never live without a human
- Admin can edit any field, then accept (activate) or reject (delete)
- Given malformed model output, Then the admin sees "generation failed, try again", never a 500

**SP-093 · AI Feedback Assistant** — `5` · A
- Given a completed assessment or a plan item marked done, Then personalised, specific,
  encouraging feedback is shown — referencing the actual weak areas, not generic praise
- Feedback is persisted, so the same result always shows the same text
- Given AI is disabled, Then a rule-based fallback message appears

**SP-094 · AI safety & cost guardrails** — `2` · all
- No PII beyond first name and scores in any prompt; a documented per-request token cap;
  rate limit on generation endpoints; all calls server-side only

---

### EPIC 10 — Quality, Docs & Demo Readiness

**SP-100 · Coverage to 75%** — `5` · all
- Gate green on `lib/domain`, `lib/services`, `lib/validation`
- Gaps closed with real behavioural tests; no tests written purely to move the number

**SP-101 · Playwright happy paths** — `5` · one each
- register → login → logout · take assessment → results → plan · admin creates question → student sees it
- Runs in CI against the preview deployment

**SP-102 · Seed script** — `3` · B
- One command creates 4 categories, ~40 questions across difficulties, 1 admin, 3 students with
  assessment history — enough to make the demo look real

**SP-103 · README & setup docs** — `3` · all
- Clone-to-running in under 10 minutes on a machine that has never seen the project
- Env vars, migrations, seeding, test commands, deployment, architecture summary

**SP-104 · Acceptance criteria audit** — `2` · all
- Every shipped story's AC re-verified against the live app during Week 6

**SP-105 · Demo script & rehearsal** — `3` · all
- 10-minute run of show: who speaks when, which decisions each person defends
- Each member can explain their AI feature *and* one architectural trade-off end to end
- Rehearsed at least twice against the deployed URL, not localhost

**SP-118 · Pin the constants that exist twice** — `2` · A
- `lib/domain/constants.ts` mirrors the XP amounts and level thresholds from
  `xp_per_assessment()`, `xp_per_score_point()`, `xp_per_plan_item()` and
  `level_for_score()` in `0002_functions.sql`. Nothing enforces that the copies agree, so a
  migration that changes an award to 60 while the constant still says 50 compiles, deploys, and
  shows every member a number they were not awarded
- Blocked on SP-003: the SQL is not in this repository, so there is no file for a test to read.
  Getting the migrations into version control is the story; this one is the test that follows
- A test asserting `XP_PER_ASSESSMENT === 50` does **not** close this. It compares the constant to
  itself. The check has to read the SQL — see the note at the top of
  `tests/lib/domain/constants.test.ts`

**SP-120 · Move current-user’s data access behind a repository** — `3` · C
- `lib/auth/current-user.ts` builds its own supabase-js queries — `getCurrentUser`,
  `loginAction`, `changePasswordAction` and `resetPasswordAction` all call
  `supabase.from('users')…` directly, and `loginAction` additionally carries the whole
  registration path
- Every other caller in the codebase goes through `lib/repositories`. This one does not, which is
  why it is the single file in `lib/auth` with no unit tests: covering it would mean mocking
  supabase-js, and `tests/README.md` rules that out with no third option
- Moving the reads and writes into `user.repo` makes it testable the same way the eight services
  are, and shrinks the only remaining gap in the auth layer's coverage
- Until then `tests/lib/auth/current-user.test.ts` stays excluded in `vitest.config.ts`, with the
  reason recorded there

**SP-121 · Test the session cookie** — `2` · C
- `lib/auth/session.ts` signs and verifies the session cookie with HMAC, and has no tests and no
  mirror file in `tests/`. It came into view when `lib/auth` was added to the coverage gate: the
  folder reads 26% because this file reads 6%
- It is pure crypto plus `cookies()` from `next/headers` — nothing to mock but the cookie store,
  so this is cheap for the risk it carries
- Worth covering: a tampered payload is rejected, a tampered signature is rejected, a cookie signed
  with a different secret is rejected, `readSession` returns null rather than throwing on
  malformed input, and the round trip survives a real user id

**SP-119 · Blank input fails at the database instead of in the form** — `2` · B
- `trimmedString(max)` trims and enforces a maximum but has no minimum, so `'   '` parses to `''`
  and passes. `registerSchema.name` is `max(60)` with no minimum, so an empty name registers
- The SQL has `length(trim(...)) > 0` checks, which means these land as a 500 from the database
  where the member should have seen a field error
- Current behaviour is pinned by tests in `tests/lib/validation/common.test.ts` and
  `auth.schema.test.ts`, both tagged `SEE SP-119` — when the minimum is added, those two tests
  flip to expecting rejection

---

### EPIC 11 — Baseline (General Knowledge) Assessment · *owner C, content by B*
*Every member who signs up meets an empty dashboard: no level, no score, no plan, and a card
inviting them to pick categories they have no basis for picking. This epic gives them a first
number to stand on.*

*It is also the narrowest possible instance of Epics 4 and 5 — one category, a fixed paper, one
attempt, no picker and no level selection — so SP-113 through SP-116 are SP-043/045/046/053 with
every variable nailed down. Build this first and most of both epics comes out with it.*

**Why 7 / 7 / 6.** Scoring stays flat — 20 questions, 5 points each, unanswered counts as wrong —
and the existing 50/80 thresholds do the placing. The mix is what makes the difficulty matter:
perfect on beginner and intermediate is 14/20 = 70%, so **level 3 needs at least two correct
advanced answers**, and all seven beginner questions alone is 35%, so **level 2 needs three from
the harder bands**. No weighting rule, no nudge. A difficulty nudge would have to land in
`grade_assessment()` first and be mirrored in `constants.ts` — see the header of
`lib/domain/levels.ts` — and that is a story of its own, not this one.

**SP-110 · Seed the General Knowledge category and its questions** — `3` · B
- One `skill_categories` row, holding exactly 7 beginner, 7 intermediate and 6 advanced active
  questions, each with one correct option
- General knowledge *of IT* — development, databases, networking, security and tooling — rather
  than any one language, so the paper places a member across the field instead of measuring how
  much JavaScript they happen to know
- Authored through the admin question bank, which is already built — this story needs no
  application code and runs in parallel with every story below
- Given the category is not excluded from the SP-040 picker, Then the one-attempt rule in SP-112 is
  decoration: it must be filtered out there

**SP-111 · Baseline card on the dashboard** — `2` · C
- Given a member with zero submitted assessments, When they open the dashboard, Then a card at the
  top offers the baseline and opens it in a **new tab**
- Given they have submitted any assessment, Then the card is replaced by their baseline result and
  does not come back
- Given the bank holds fewer than the full 7/7/6, Then no card renders at all — a short paper
  places people wrongly, which is worse than not offering one

**SP-112 · Start or resume, one attempt** — `3` · C
- Opening the baseline route creates an `assessments` row (`in_progress`, `time_limit_seconds` set)
  plus one `student_responses` row per question in one transaction, drawn 7/7/6 by difficulty
- Given a run already in progress, When they open it again, Then they land back in that same run
- The attempt is spent on **submit**, not on open: closing the tab mid-run is resumable

**SP-113 · Take the baseline** — `5` · C
- Questions in a fixed order; selecting an option persists `selected_answer_id` immediately
- Given I answered 8 of 20, When I hard-refresh, Then the same paper reloads with those 8 still
  selected. Nothing in `localStorage`
- Progress indicator shows answered / total

**SP-114 · Timer** — `3` · C
- One constant: 25 minutes for 20 questions. Countdown visible throughout
- On expiry the run auto-submits with whatever was answered
- Server recomputes elapsed time from `started_at` on submit — a frozen client gains nothing

**SP-115 · Submit, grade and place** — `5` · C
- Score computed server-side, `is_correct` written per response, status → `submitted`
- `category_progress` carries the resulting level, and it is the level the dashboard shows
- Given I resubmit the same assessment, Then it is rejected — no double scoring

**SP-116 · Baseline results** — `3` · C
- Total score, the level it implies, and the **per-difficulty breakdown** — 7/7 beginner,
  4/7 intermediate, 1/6 advanced — which is the number that tells a member what to do next
- Per-question review after submission only
- Given another member's assessment id, Then 404

**SP-117 · The baseline seeds the first plan** — `3` · A
- Given a score below the weak-area threshold, Then plan items are generated from the bands that
  were missed
- Given a score above it, Then the "you're solid, pick your categories" item appears — never an
  empty plan page
- Given the same result twice, Then the same items: `buildPlan` stays pure and deterministic

---

## Summary

| Epic | Pts | Owner |
|---|---|---|
| 0 · Foundation | 24 | all |
| 1 · Auth & Roles | 14 | A |
| 2 · Profile | 10 | A |
| 3 · Catalog & Question Bank | 25 | B |
| 4 · Assessment | 34 | C |
| 5 · Scoring & Results | 18 | C |
| 6 · Learning Plan | 18 | A |
| 7 · Progress | 9 | A |
| 8 · Admin & Search | 19 | B |
| 9 · AI Features | 20 | all |
| 10 · Quality & Demo | 21 | all |
| 11 · Baseline Assessment | 27 | C |
| **Total** | **≈239** | |

That is more than three weeks of capacity, which is the point — a backlog is a ranked list, not a
contract. **Cut in this order** when you fall behind: SP-048 (multi-category), SP-071 (trend chart),
SP-065, SP-072, SP-047, then the third AI feature. Protect Epic 0, Epic 4, Epic 5 and Epic 10 at all
costs — they are the demo.

Epic 11 is not a competitor to Epic 4, it is the cheap way to buy it: the same code paths with every
variable fixed. Its 27 points are mostly points Epic 4 and Epic 5 were going to cost anyway, so it
belongs at the front of the assessment work rather than at the end of the backlog.

---

## Part 3 — Where every story actually stands

Checked against `main` at `9282ea2` on 27 August 2026. A story is **done** only
if its acceptance criteria hold against the running app — not if the file
exists. Several stories are marked partial for the same two reasons throughout
(no password check, no RLS), and those two are recorded once in
`docs/ARCHITECTURE.md` §0 rather than repeated here.

### Epic 0 — Foundation · **1 of 6**

| Story | State | |
|---|---|---|
| SP-001 Repo, Next, Tailwind, strict TS | **Done** | `strict: true`, `.env.example` committed. `any` does not fail lint, because there is no ESLint config |
| SP-002 Supabase project + three clients | **Partial** | Only `server.ts`. No `client.ts`, no `admin.ts`, so the service-role build-failure AC is untested |
| SP-003 Migration 0001 — schema | **Not done** | The schema exists in the hosted project only. There is no `supabase/` directory and no `.sql` file in the repo. **This is the highest-priority item in the backlog** |
| SP-004 Migration 0002 — RLS + `answer_options` | **Not done** | RLS is off everywhere; `answers.is_correct` is readable with the anon key |
| SP-005 CI pipeline | **Not done** | `ci.yml` has no `on:` and no `jobs:`. `main` is not protected |
| SP-006 Tracer bullet | **Not done** | No path exists from a seeded question to a score on screen. Skipped, and the rest of this table is downstream of that |

### Epic 1 — Auth & Roles · **2 of 6, 3 partial**

| Story | State | |
|---|---|---|
| SP-010 Login / logout | **Partial** | Sign-in and sign-out work; `Cache-Control: no-store` covers the Back-button AC. No password is verified, and `?error=not_found` tells a caller whether an email exists — the opposite of the "one generic error" AC |
| SP-011 Registration | **Partial** | Creates the `users` row, honours the role selector, seeds `category_progress` from the chosen interests, and rejects a duplicate email *and* a duplicate first+last name. An admin registration requires a manager-approval checkbox. No `auth.users`, no trigger, no password |
| SP-012 Route protection by role | **Done** | Middleware redirects, `assertAuth` / `assertAdmin` enforce. The "would fail on RLS anyway" half of the AC does not hold |
| SP-013 Role escalation is impossible | **Partial** | Role is read from the database on every request and never from the cookie or the form, and `profileSchema` has no `role` key. But with RLS off, a direct PostgREST `PATCH` sets `role='admin'` |
| SP-014 Deactivated users are locked out | **Done** | `status !== 'active'` is refused at sign-in, and an inactive admin cannot reach `/admin` |
| SP-015 Seed an admin account | **Not done** | No script. The documented path is registering with the Administrator option, or editing the row by hand |

### Epic 2 — Profile · **3 of 4**

| Story | State | |
|---|---|---|
| SP-020 View my profile | **Done** | |
| SP-021 Edit name and interests | **Done** | Interests carry their level; `role`, `status` and `email` are unwritable |
| SP-022 Learning objectives | **Not done** | No column, no field, no schema |
| SP-023 Assessment history | **Done** | Renders the empty state today, because nothing produces an assessment |

### Epic 3 — Catalog & Question Bank · **6 of 9**

| Story | State | |
|---|---|---|
| SP-030 Admin lists categories | **Done** | Paged, filtered, with question counts |
| SP-031 Create / edit a category | **Done** | |
| SP-032 Deactivate a category | **Done** | |
| SP-033 Admin lists questions | **Partial** | The list lives inside `admin/categories/[id]` rather than a page of its own, and is unpaginated |
| SP-034 Create a question with answers | **Done, rule changed** | 2–6 options, and **multiple correct answers are now allowed**. The "exactly one correct" unique index was dropped; the replacement rule lives in `questionSchema` only |
| SP-035 Admin edits a question | **Done** | The D4 snapshot guarantee is untested — nothing has submitted a response yet |
| SP-036 Activate / deactivate a question | **Done** | `setQuestionStatus` behind `assertAdmin()` |
| SP-037 Question-bank writes via the service role | **Partial** | The `assertAdmin()` half is done, in the service, before the read. There is no service-role client |
| SP-038 Answers never leaked to the browser | **Partial** | No student-facing query selects `is_correct` — but there is no student-facing assessment page yet, and the anon key reads the column directly |

### Epic 4 — Assessment · **0 of 9**

Nothing. `/assessments/new`, `/assessments/[id]` and the results route render
`ComingSoon`; `assessment.service`, `response.repo`, `timer.ts` and the four
client components are comment-only. `assessments.grade()` exists in the
repository as an RPC wrapper and has no caller.

### Epic 5 — Scoring & Results · **0 of 6**

Nothing. `scoring.ts`, `weak-areas.ts` and `grading.service` are comment-only.
`levels.ts` is written and holds the 50/80 thresholds, so SP-051 is half-built
below the surface — but nothing calls it with a real score.

### Epic 6 — Learning Plan · **1 of 6, 1 partial**

| Story | State | |
|---|---|---|
| SP-060 Rule-based plan generation | **Not done** | `recommendations.ts` is comment-only |
| SP-061 Plan persisted on submit | **Not done** | No submit path exists |
| SP-062 Plan page | **Not done** | `/plan` is `ComingSoon` |
| SP-063 Update item status | **Done, in the wrong place** | The control works and only writes `progress_status` — but it lives in the profile page's plan section, not on `/plan`. XP for completion is awarded by database trigger |
| SP-064 Empty and strong-performer states | **Partial** | The profile plan section has an empty state; the "try the next level" state needs SP-060 |
| SP-065 Plan reflects only the latest assessment | **Not done** | |

### Epic 7 — Progress · **3 of 4**

| Story | State | |
|---|---|---|
| SP-070 Student dashboard | **Done** | Per-category level, latest score, plan completion, XP, streak |
| SP-071 Score trend over time | **Not done** | `score-trend-chart.tsx` is comment-only; it needs a query nothing else needs |
| SP-072 Overall completion | **Done** | |
| SP-073 First-run empty state | **Done** | Every block either renders an empty state or does not render |

### Epic 8 — Admin Dashboard, Search & Filtering · **5 of 7**

| Story | State | |
|---|---|---|
| SP-080 Overview tiles | **Done** | |
| SP-081 Aggregated weak categories | **Done** | Computed by the `category_score_summary` view, not in JS |
| SP-082 All results list | **Done** | Sortable, paged |
| SP-083 User management list | **Done** | Search, role and status filters, status toggle. An admin cannot deactivate themselves, and the refusal is rendered |
| SP-084 Question search & filtering | **Not done** | The only question list is per-category and has no filters |
| SP-085 Category & results filtering | **Done** | URL state throughout, parsed by `filters.schema.ts` |
| SP-086 Search performance | **Partial** | Every list is paged in Postgres and none is unbounded. Nothing has been checked with `EXPLAIN`, and the indexes were never written down (SP-003) |

### Epic 9 — AI Features · **0 of 5**

Nothing. `lib/ai/` is six comment-only files totalling 92 lines. No `AI_PROVIDER`
variable, no `ANTHROPIC_API_KEY` in `.env.example`, no mock fixtures.

### Epic 10 — Quality, Docs & Demo · **1 of 9, 1 partial**

| Story | State | |
|---|---|---|
| SP-100 Coverage to 75% | **Done** | 30 files, 315 tests, green. Gate passes across `lib/domain`, `lib/services`, `lib/validation`, `lib/auth`: 91.74% statements, 92.48% lines, 84.68% branches. `lib/services` is at 100% on all four. The one weak spot is `lib/auth/session.ts` — see SP-121 |
| SP-101 Playwright happy paths | **Not done** | `e2e/` does not exist |
| SP-102 Seed script | **Not done** | `package.json` declares `seed` and `seed:users`; both point at missing files and fail |
| SP-103 README & setup docs | **Partial** | The README is written, but clone-to-running is impossible without access to the existing Supabase project — see SP-003 |
| SP-104 Acceptance criteria audit | **In progress** | This section is it |
| SP-105 Demo script & rehearsal | **Not done** | |
| SP-118 Pin the duplicated constants | **Not done** | Blocked on SP-003 — the SQL is not in the repo |
| SP-119 Blank input fails at the database | **Not done** | Current behaviour pinned by tests tagged `SEE SP-119` |
| SP-120 Move current-user behind a repository | **Not done** | The one file in `lib/auth` with no tests — it builds supabase-js queries inline |

### Epic 11 — Baseline Assessment · **0 of 8**

Not started. Note that SP-110 — authoring the General Knowledge questions —
needs no application code and is unblocked today: the admin question bank
works.

### What this adds up to

**21 of 76 stories are done.** They cluster almost perfectly: everything that
renders a page about a member is built, and everything that measures one is
not. The single missing capability behind Epics 4, 5, 6, 9 and 11 is *taking an
assessment*, and the single missing artefact behind Epic 0 is *the schema*.

If only two things get picked up: **SP-003** (dump the live schema into a
migration — an hour, and it unblocks SP-004, SP-005 and every test in
`tests/db/`) and **Epic 11** (the narrowest possible assessment, which drags
most of Epics 4 and 5 in behind it).
