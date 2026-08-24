# SkillPath — Epics & Stories

Companion to `SkillPath-Architecture.md`. Bring both to the mentor check-in.

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
| **Total** | **≈212** | |

That is more than three weeks of capacity, which is the point — a backlog is a ranked list, not a
contract. **Cut in this order** when you fall behind: SP-048 (multi-category), SP-071 (trend chart),
SP-065, SP-072, SP-047, then the third AI feature. Protect Epic 0, Epic 4, Epic 5 and Epic 10 at all
costs — they are the demo.
