# SkillPath — Architecture Specification

**Status:** partly built. §0 says which parts.
**Team:** 3 engineers · **Build window:** Weeks 3–5 · **Feature freeze:** Week 6

---

## 0. What is true today

This document was written before the code and describes the system the team
intended to build. A good deal of it is now accurate. Some of it is not, and a
specification that quietly disagrees with its own repository costs a new
teammate a day before they notice.

So the disagreements are listed here rather than left to be discovered. **Where
this section and the rest of the document conflict, this section is right.**

### Built and accurate

| Area | Where |
|---|---|
| The five-layer rule (§3) | Followed by the profile slice end to end |
| `Result<T, AppError>` across layers (§8) | `lib/result.ts`, `lib/errors.ts` |
| Repositories as the only supabase-js importers (§3) | `lib/repositories/` |
| Zod at every Server Action boundary (§5) | `lib/validation/` |
| Schema, constraints and invariants (§4.1, §4.4) | `supabase/migrations/` |
| Grading in the database, never the browser (§5) | `grade_assessment()` in `0002` |

### Not true, and why

| §  | The document says | Actually |
|---|---|---|
| 2, 4, 5 | Supabase Auth (GoTrue) owns credentials; `profiles.user_id uuid` references `auth.users(id)` | **Not built.** There is a plain `users` table with a `password` column, integer primary keys, and a signed session cookie of our own (`lib/auth/session.ts`). Sign-in verifies **no password at all** — it takes an email and signs you in. This is a deliberate, recorded team decision, not an oversight; see the header of `lib/auth/current-user.ts`. Deviation **D1** was therefore never applied. |
| 5 | Row Level Security is the real authorization boundary; every table has policies | **Not built.** RLS is off on every table and the anon key — which is public by design — can read and write all of them. Ownership is enforced only by the `.eq('user_id', …)` clause in each repository. The policy set in §5 is the design to apply when this is revisited; it would land as `0003_rls.sql`. |
| 3 | Three Supabase clients: `server.ts`, `client.ts`, `admin.ts` | Only `server.ts` exists. There is no service-role client, because with RLS off there is nothing for it to bypass. |
| 4.4 | Table names `profiles`, `skill_categories`, `questions`, `answers`, `assessments`, `student_responses`, `recommendation_plans` | All correct **except** `profiles`, which is `users`. The database originally used singular names (`assessment`, `question`); the restructure renamed them to match this document. |
| 5 | `answers` is revoked from the API and read through an `answer_options` view | **Not built.** `answers.is_correct` is reachable over PostgREST with the anon key, so the answer key is currently obtainable. Grading itself is safe — it runs inside `grade_assessment()` — but the key is not hidden. Blocked on the same RLS decision. |
| 6 | Three AI features behind an `AiProvider` interface | **Not built.** `lib/ai/` is a set of scaffolded files with no implementations. |
| 7 | Vitest, RTL, Playwright, 75% coverage gate | **Not built.** There is no test runner installed and no test in the repository. `tests/` holds ~83 files that describe intended cases in comments; none of them execute. |
| 8, 9 | CI runs typecheck → lint → coverage → build | **Not built.** `.github/workflows/ci.yml` is a commented-out sketch with no `on:` and no `jobs:`, so it runs nothing. There is no ESLint config either. `tsc --noEmit` does pass. |
| 8 | Types generated with `supabase gen types` | Hand-written in `lib/supabase/database.types.ts`. The project is not linked to the CLI. A migration and that file must change in the same commit. |

### Slices

Of the twelve slices in §9, one is built: **1 — Auth, roles, middleware, profile
page**, minus the auth half. The dashboard, plan, assessment and admin routes
exist as `ComingSoon` placeholders, which is why the header links to pages that
say so rather than crashing.

---

## 1. Scope

A **student** picks a skill category and a target level, takes a multiple-choice assessment, gets a
score with weak areas identified, receives a prioritised learning plan, and tracks progress on it.
An **admin** manages the category catalog and question bank, and sees aggregate data. Three AI
features sit *on top of* the rule-based core — never in place of it.

---

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router), TypeScript `strict` | Mandated; Server Components query Postgres without a hand-written API layer |
| Data + Auth | Supabase (Postgres, GoTrue, RLS) | Mandated; RLS puts authorization *in the database*, where a forgotten `if` can't defeat it. **GoTrue and RLS are both unbuilt — see §0.** |
| Client lib | `@supabase/ssr` | Cookie sessions that work in RSC, actions and middleware |
| UI | Tailwind + shadcn/ui | No design bikeshedding, accessible primitives, editable components |
| Validation | Zod | One schema shared by the client form and the server action |
| Tests | Vitest + RTL, Playwright for 3 happy paths | Mandated; 75% gate on business logic. **Not installed — see §0 and §7.** |
| CI/CD | GitHub Actions → Vercel | Push to `main` deploys; PRs get preview URLs. **The workflow is a sketch and runs nothing — see §0.** |

**Non-goals for 6 weeks:** real-time, file uploads, i18n, email flows beyond Supabase's built-in
confirmation, code blocks/images in questions.

---

## 3. The layer rule — read before your first commit

Every feature is a vertical slice through the same five layers. **Dependencies point downward only.**

```
app/**/page.tsx        Server Components. Fetch + render.
                       No business logic, no supabase-js imports.
─────────────────────────────────────────────────────────────
app/**/actions.ts      Server Actions. assertAuth → zod.parse →
                       service → revalidatePath → redirect. ~15 lines.
─────────────────────────────────────────────────────────────
lib/services/*.ts      Orchestration. Permission checks, multi-step
                       writes, calls domain + repositories.
─────────────────────────────────────────────────────────────
lib/domain/*.ts        PURE functions. Scoring, level estimation,
                       recommendation rules. NO I/O.  ◄── coverage lives here
─────────────────────────────────────────────────────────────
lib/repositories/*.ts  The ONLY files importing supabase-js.
                       snake_case rows in, camelCase types out.
```

Three consequences worth internalising:

1. **`lib/domain` is where the 75% requirement gets satisfied**, because pure functions need no
   mocks, no database, no React. If you're mocking Supabase to test a scoring rule, the rule is in
   the wrong layer.
2. **A page never calls a repository directly.** Even for a read-only list — the thin service
   function is where the permission check goes.
3. **Repositories never call services.** No cycles, ever.

### Folder structure

```
skillpath/
├── app/
│   ├── (auth)/           login/ register/
│   ├── (student)/
│   │   ├── dashboard/            progress per category
│   │   ├── profile/
│   │   ├── assessments/new/      category + level picker
│   │   ├── assessments/[id]/     the run (client component)
│   │   ├── assessments/[id]/results/
│   │   └── plan/                 recommendations + status toggle
│   ├── (admin)/admin/            page · categories/ · questions/ · users/
│   └── api/                      only where a Server Action can't be used
├── components/           shared, presentational, no data fetching
├── lib/
│   ├── domain/           scoring.ts levels.ts recommendations.ts constants.ts types.ts
│   ├── services/         assessment.service.ts question.service.ts …
│   ├── repositories/     assessment.repo.ts question.repo.ts …
│   ├── ai/               provider.ts anthropic.ts mock.ts schemas.ts
│   ├── supabase/         server.ts database.types.ts env.ts
│   ├── validation/       zod schemas, shared client+server
│   └── auth/             assertAuth.ts assertAdmin.ts
├── supabase/migrations/  NNNN_name.sql — append-only. THE schema.
├── docs/                 ARCHITECTURE.md BACKLOG.md TESTING.md
└── e2e/                  Playwright happy paths
```

### The three Supabase clients

| File | Key | Use for |
|---|---|---|
| `lib/supabase/server.ts` | anon + user cookie | **Default.** Everything a user does as themselves |
| `lib/supabase/client.ts` | anon + user session | Only interactive work that must not round-trip |
| `lib/supabase/admin.ts` | **service role** | Grading, aggregates, question-bank writes. Guarded by `assertAdmin()` |

`admin.ts` starts with `import 'server-only'`. If the service-role key ever reaches a client bundle,
the build must fail — that's what the import buys.

> **Only `server.ts` exists.** There is no service-role client and no browser
> client. With RLS off there is nothing for a service-role key to bypass, so
> adding one now would be a second way to do exactly what the anon key already
> does — more key material, no more capability. Build `admin.ts` at the same
> time as the RLS policies, not before.
>
> Grading was the main reason the table lists a service-role client, and it no
> longer needs one: `grade_assessment()` is `SECURITY DEFINER`, so the answer
> key is read inside the database and never travels.

One thing `server.ts` does that is easy to miss: it passes the `<Database>`
generic. Without it the client is `SupabaseClient<any>`, `any` satisfies the
`SupabaseClient<Database>` annotation every repository declares, and the whole
repository layer type-checks against nothing — which is how the reads ended up
needing `data as unknown as Array<…>` to compile.

---

## 4. Data model

`Diagrama.pdf` is the contract. Six deviations, each with a reason — and, now
that the schema is built, where each one actually stands.

| # | Diagram says | Decision | Why | Status |
|---|---|---|---|---|
| D1 | `USER.password string` | Drop it. `profiles.user_id uuid PK → auth.users(id)` | Supabase Auth owns credentials. Our own password column means hashing, resets and lockout are ours to get wrong. | **Not applied.** `users.password` exists and is never read; sign-in verifies nothing. Deferred by decision — §0. |
| D2 | `selected_answer_id` implicitly required | Nullable + add `position` | Lets us **pre-create one row per question at generation time**. Refresh mid-assessment re-reads the same rows in the same order. Requirement #5 ("the session must be saved") met with **no extra table**. | Applied |
| D3 | `ASSESSMENT` has no state | Add `status`, `requested_level`, `submitted_at`, `session_id` | An assessment exists before it's scored. The brief requires selecting *a level*. `session_id` groups a multi-category run (§4.2). | Applied, plus `started_at` and `time_limit_seconds` — see §11 |
| D4 | responses store only the choice | Add `is_correct boolean` snapshot | If an admin fixes an answer key next week, a past result must not silently change. Grade once, store the verdict. | Applied |
| D5 | `ai_description` only | Split `rule_description` (always set) + `ai_description` (nullable) + `priority` | The plan must render correctly with AI disabled or failing. Rules decide; AI decorates. | Applied |
| D6 | `float total_score` | `numeric(5,2)`, 0–100 | Floats compare and print badly. Percentages are exact decimals. | Applied |

Plus two small additions: `skill_categories.status` (turns destructive deletes into deactivation)
and `questions.source` (`manual`/`ai`, so the dashboard can show which questions the AI drafted —
cheap, good demo material). Both applied.

And one the diagram does not anticipate at all: **`xp_events`**, the XP ledger.
§4.4 explains why it exists.

### 4.1 Invariants enforced by the database, not by hope

- **Answer-key shape is no longer one of these.** `answers_one_correct_per_question` — a partial
  unique index allowing at most one correct answer per question — was dropped when multi-select
  questions arrived. The replacement rule (at least one correct, not all correct) lives in
  `questionSchema` alone, so it now holds only for writes that come through the application. A
  direct write can store a question with no correct answer at all, which the index used to make
  impossible. Worth restoring as a CHECK if that ever bites.
- **`one_active_assessment_per_user_category`** — partial unique on
  `(user_id, category_id) WHERE status='in_progress'`. Two browser tabs cannot start two runs.
- **`assessments_score_present`** — `CHECK ((status='submitted') = (total_score IS NOT NULL))`,
  and the same shape for `submitted_at`. Grading must go through `grade_assessment()`; setting
  the status by hand is rejected.
- `UNIQUE (assessment_id, question_id)` and `UNIQUE (assessment_id, position)` on responses.
- `UNIQUE (user_id, category_id)` on `category_progress`.
- `UNIQUE (user_id, category_id, topic_title)` on `recommendation_plans` — re-assessing updates a
  plan item rather than stacking a duplicate.
- **`xp_events_assessment_once` / `_plan_item_once` / `_badge_once` / `_quest_once_per_day`** —
  partial unique indexes on the ledger. Every award path can run twice and pay once, which is what
  lets the badge write happen on every profile render without a check.
- `users.email` is `citext` and unique. `'Ana@x.ro'` and `'ana@x.ro'` were two accounts before, and
  the sign-in lookup used `.maybeSingle()`, which errors outright when two rows come back.

Each of these is a bug we never have to write a test for — which matters more than usual here,
because there are no tests (§7).

### 4.2 Multi-category assessments

The diagram binds one assessment to one category; the brief says students select *categories*.
Rather than fight the schema:

> **MVP:** one assessment = one category. The picker allows multiple and creates **N assessment rows
> sharing one `session_id`**. The results page groups by `session_id` and shows the per-category
> breakdown — exactly what requirement #7 asks for.

If Week 5 runs short: ship the single-category picker, leave `session_id` null. Nothing else changes.

### 4.3 Domain rules (pure, in `lib/domain`)

```ts
scoreAssessment(responses, answerKey): { correct, total, percentage }
estimateLevel(percentage, difficultyMix): SkillLevel
identifyWeakAreas(perCategory, threshold = 60): CategoryId[]
buildPlan(weakAreas, catalog): PlanItem[]   // deterministic, priority 1–5
```

Thresholds live in **one** file, `lib/domain/constants.ts`: `<50` beginner, `50–79` intermediate,
`≥80` advanced; weak area `<60`. Never inline these numbers elsewhere — mentors will ask where the
level comes from, and there should be exactly one answer.

### 4.4 Schema

**The schema is `supabase/migrations/0001_init.sql` and `0002_functions.sql`.
It is not reproduced here.**

It used to be. This section carried a full `create table` script, and by the
time anyone read it the script described tables that did not exist: `profiles`
instead of `users`, uuid keys instead of integers, plural names while the
database used singular, `not_started` while the database stored `not started`.
A schema written in two places drifts, and the copy in the prose is always the
one that loses. Read the migrations; they are commented at least as heavily as
this was.

What is worth recording here is the *shape* and the reasoning, which the
migrations then implement.

**Tables.** `users`, `skill_categories`, `questions`, `answers`, `assessments`,
`student_responses`, `category_progress`, `recommendation_plans`, `xp_events`.

**Views.** `user_xp_totals` (a SUM over the ledger) and `leaderboard` (that
total, ranked, for active students).

**Functions.** `grade_assessment(assessment_id)`, `current_streak(user_id)`,
`level_for_score(score)`, and the three XP amounts as immutable functions.

**Triggers.** `updated_at` on five tables; XP awarded on assessment submission
and on plan-item completion; `completed_at` kept consistent with
`progress_status`; `category_progress` updated from a graded assessment.

#### XP is stored, not recomputed

The one addition the diagram does not anticipate. `xp_events` is an append-only
ledger: every award is a row carrying its amount, its reason, the assessment or
plan item that caused it, and when. A total is a `SUM`.

It exists because the first implementation derived XP, badges, streaks and daily
quests from raw rows on every render and stored none of it. That was honest
about its own limits — its header admitted a badge could only know the date it
was earned when some other row happened to carry one, which was rarely — but the
limits were real: no streak that counted anything except assessments, no history,
no way to tell a member *why* they had the XP they had, and a leaderboard that
had to read every assessment and every plan row for every student to produce a
number.

The trade is that XP amounts now live in SQL as well as in
`lib/domain/constants.ts`, and nothing enforces that the two agree. See the note
at the top of that file.

## 5. Security model

> ### Status: this section is a design, not a description
>
> **Row Level Security is not enabled on any table**, and the `answer_options`
> view below does not exist. The anon key — which is public by design and
> intended to reach the browser — can read and write every table directly
> through PostgREST, including `users` and including `answers.is_correct`.
>
> What actually protects data today is (a) the session cookie, which is
> HMAC-signed so it cannot be edited into a different user or role, (b) the
> `assertAuth()` / `assertAdmin()` guard at the top of every protected page and
> Server Action, and (c) the explicit `.eq('user_id', …)` clause in every
> repository query. That is authorization in application code — exactly what
> the opening line of this section says not to rely on.
>
> This is a **recorded team decision to defer**, taken knowingly, not a gap
> nobody noticed. Everything below is the design to apply when it is revisited;
> it would land as `0003_rls.sql`. Until then, treat the database as public and
> do not put anything in it that matters.
>
> One thing to keep in mind while it is deferred: **every `.eq('user_id', …)`
> in `lib/repositories/` is load-bearing.** With RLS on, forgetting one is a
> redundant clause. Without it, forgetting one is a data leak.

Authorization lives in three places, deliberately.

**(a) Middleware** refreshes the session and bounces anonymous users out of `(student)` and
`(admin)`. A redirect convenience, *not* a security boundary — never the only check.

**(b) Row Level Security** is the real boundary for user-owned data. Students see their own
assessments, responses, progress and plans; admins see everything. Because a policy that reads
`profiles` from inside a `profiles` policy recurses, role lookups go through a `SECURITY DEFINER`
function:

```sql
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
                 where p.user_id = auth.uid()
                   and p.role = 'admin' and p.status = 'active');
$$;
revoke execute on function public.is_admin() from public;
grant  execute on function public.is_admin() to authenticated;
```

**(c) `assertAdmin()` in the service layer** for the two things RLS structurally cannot do.

### The `is_correct` problem — explain this at the demo

RLS filters **rows, not columns**. A student holding the anon key can call PostgREST directly:

```
GET /rest/v1/answers?select=is_correct,question_id
```

No row policy stops that. The answer key leaks and the product is a toy. Our fix:

```sql
revoke all on public.answers from anon, authenticated;

create view public.answer_options as
  select answer_id, question_id, answer_text, position from public.answers;

grant select on public.answer_options to authenticated;
```

The view is a *security-definer* view (Postgres default), so it runs as its owner and exposes only
the three safe columns. The base table is unreachable over the API by anyone.

**The trade-off, stated plainly:** admins lose PostgREST access to `answers` too. Question-bank reads
and writes therefore run server-side through `question.repo.ts` with the service-role client, gated
by `assertAdmin()`. We are consciously moving *that one slice* of authorization from the database
into code, because the alternative — a column the API will hand out — is worse.

Grading follows the same path: `assessment.service.ts` fetches the key with the admin client, calls
pure `scoreAssessment`, writes back per-response `is_correct` and `total_score`.
**No score is ever computed in the browser.**

Same shape of problem on `profiles`: a student must edit their name but not set `role='admin'`. RLS
can't restrict a column, so a `BEFORE UPDATE` trigger resets `role` and `status` to their old values
unless `is_admin()`.

### Policy sketch — would be `supabase/migrations/0003_rls.sql`

Table names below follow the Supabase Auth design, where `users` becomes
`profiles`. Read `profiles` as `users` against today's schema.

| Table | Student | Admin |
|---|---|---|
| `profiles` | select/update own (trigger guards `role`, `status`) | select/update all |
| `skill_categories` | select where `status='active'` | full |
| `questions` | select where `status='active'` | full (via service role) |
| `answers` | **no direct access** → `answer_options` view | via service role |
| `assessments` | select/insert/update own | select all |
| `student_responses` | via `exists(assessment owned by auth.uid())` | select all |
| `category_progress` | select own; writes service-role only | select all |
| `recommendation_plans` | select own, update `progress_status` only | select all |

Enable RLS on **every** table. A table without RLS in Supabase is world-readable.

### Other rules

- Server Actions validate **every** input with Zod. A Server Action is a public HTTP endpoint.
- Never trust `user_id` / `category_id` from a form; derive ownership from `auth.uid()`.
- Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.
  Commit a `.env.example` with empty values.

---

## 6. AI architecture

One interface, two implementations, chosen by env var:

```ts
// lib/ai/provider.ts
export interface AiProvider {
  enhancePlan(input: PlanContext): Promise<EnhancedPlan>       // Dev C
  generateQuestions(input: GenSpec): Promise<DraftQuestion[]>  // Dev B
  feedback(input: FeedbackContext): Promise<string>            // Dev A
}
```

`AI_PROVIDER=mock` → deterministic fixtures. **Default in tests and CI** — a broken API key never
blocks a teammate. `AI_PROVIDER=anthropic` → real calls, server-side only, 10s timeout, one retry,
then fall back.

Four rules that turn "we called an LLM" into a 4–5 point feature:

1. **Model output is untrusted input.** Parse every response with a Zod schema before it goes near
   the database. A malformed generation is a caught error, not a 500.
2. **Degrade, never block.** The results page renders the rule-based plan immediately; the AI text
   streams in or appears on refresh. Provider down → page still correct.
3. **Human in the loop.** AI questions insert with `status='inactive'`, `source='ai'`. The admin
   reviews, edits, activates. The schema already supports this — "accept / edit / reject" is a
   status change, no new table.
4. **Persist the output.** `ai_description` is stored, not regenerated per page view. Cost, latency
   and reproducibility in one decision.

---

## 7. Testing strategy

> ### Status: nothing here is built
>
> There is **no test runner installed** — no Vitest, no Playwright, no
> `vitest.config.ts` — and **no test in the repository executes**.
>
> `tests/` contains roughly 83 files named `*.test.ts`. Every one of them is a
> docblock describing the cases it intends to cover, with no code beneath it.
> They are useful as specifications and they are the right list of cases. They
> are not tests, and a directory that looks like a 83-file suite is worth being
> explicit about, because at a glance it does not look like zero.
>
> `package.json` has no `test`, `typecheck` or `lint` script, so the commands
> `.github/workflows/ci.yml` refers to do not exist either — and that workflow
> is itself entirely commented out, with no `on:` and no `jobs:`, so it runs
> nothing on any push.
>
> **This is a deliberate deferral for now, not an oversight.** The consequence
> worth stating: the two places where a business number is duplicated between
> SQL and TypeScript (XP amounts, level thresholds) have nothing checking that
> the copies agree. See the note at the top of `lib/domain/constants.ts`.
>
> What is below is the plan for when tests arrive. It is a good plan; the
> aiming of the coverage gate in particular is the part worth keeping.

The requirement is 75% **on business logic**, and the brief says explicitly not to inflate it with
artificial UI tests. So aim the gate precisely:

```ts
// vitest.config.ts
coverage: {
  include: ['lib/domain/**', 'lib/services/**', 'lib/validation/**'],
  thresholds: { lines: 75, functions: 75, branches: 70, statements: 75 }
}
```

| Layer | How |
|---|---|
| `lib/domain` | Table-driven unit tests, no mocks. Target ~95% |
| `lib/services` | Repositories injected as in-memory fakes (`InMemoryQuestionRepo`) — no database needed |
| `lib/repositories` | Integration tests against a seeded Supabase test project; **excluded from the gate** |
| Components | RTL only where there's real logic (assessment run, question editor). Not static markup |
| E2E | Playwright ×3: register→login→logout · take assessment→results · admin creates question→student sees it |

Repositories are injected into services *specifically* so service tests need no Supabase mock.
Design for the test at the moment you write the service.

---

## 8. Conventions

- **Migrations are append-only.** `supabase/migrations/NNNN_description.sql`. Never edit a merged
  migration — add a new one. Claim your number in team chat first; it's the one file where conflicts
  genuinely hurt.
- **Types are hand-written, for now:** `lib/supabase/database.types.ts` is maintained by hand,
  because the project is not linked to the Supabase CLI and `supabase gen types` has nothing to
  point at. **A migration and that file change in the same commit** — otherwise the app compiles
  against a schema that is not there and fails at runtime. Wiring up generation is the real fix.
- **snake_case in SQL, camelCase in TS.** Mapping happens in the repository and nowhere else.
- **Errors:** services return `Result<T, AppError>`, not thrown exceptions across layers. Actions map
  to form state; unexpected throws hit `error.tsx`.
- **`any` is banned.** So is disabling a lint rule without a comment saying why.
- **Branches:** `feat/<slice>-<short>` → PR into `main`, one approval, CI green. Nobody approves
  their own.
- **CI in Week 3, not Week 6:** typecheck → lint → `vitest --coverage` (fails under threshold) →
  `next build`. *(Not built — see §7. `tsc --noEmit` passes and is currently run by hand.)*

---

## 9. Build order — tracer bullet first

Slice 0 is deliberately absurd in its narrowness: **one category, one question, one assessment, one
score, on screen.** It touches every layer and every piece of infrastructure. Until it's merged,
nobody starts a real feature.

| When | Slice | Owner |
|---|---|---|
| **W3 d1–2** | **0 — Tracer bullet:** repo, CI, migrations 0001+0002, 3 Supabase clients, seed 1 category / 1 question, hardcoded run → score → screen | all three, paired |
| W3 | 1 — Auth, roles, middleware, profile page | A |
| W3 | 2 — Categories + question bank CRUD, answer validation | B |
| W3 | 3 — Assessment generation (pre-created response rows, refresh-safe) | C |
| W4 | 4 — Assessment run + submit | C |
| W4 | 5 — Scoring, level estimation, results page | C |
| W4 | 6 — Recommendation rules + plan page + status toggle | A |
| W4 | 7 — Progress dashboard (`category_progress`) | A |
| W4 | 8 — Admin dashboard aggregates + search/filter everywhere | B |
| W5 | 9 — AI Feedback Assistant | A |
| W5 | 10 — AI Question Generator (draft → review → activate) | B |
| W5 | 11 — AI Recommendation Enhancer | C |
| W5 | Hardening: coverage to 75%, Playwright ×3, seed data, README | all |
| W6 | Freeze. Bugs, tests, docs, demo rehearsal | all |

The split keeps each person mostly in their own folders — A in `(auth)`/`plan`, B in `(admin)`,
C in `assessments` — so merge conflicts concentrate only in `lib/domain/types.ts` and migrations,
both of which are small and reviewed together.

---

## 10. Known risks

| Risk | Mitigation |
|---|---|
| RLS silently blocks a query and it just looks like an empty list | Every repository checks and logs `error` explicitly; never `data ?? []` on a failed query. One policy test per table in Slice 0 |
| Three people editing the schema in Week 3 | Numbered migrations, claimed in chat; schema PRs reviewed by all three |
| An AI feature slips and eats Week 5 | Mock provider is the default. A merged mocked feature beats an unmerged real one |
| Coverage panic in Week 6 | Gate is in CI from Slice 0. It cannot suddenly be 30% |
| Assessment lost on refresh (explicit brief requirement) | Solved structurally by D2 + the partial unique index — not by localStorage |

---

## 11. Open questions for the mentor check-in

**Question 2 is now closed.** `time_limit_seconds` and `started_at` are in
`0001_init.sql`, on the reasoning given below — the columns cost nothing unused,
and bolting them on mid-build would have cost a migration and a backfill.
Nothing enforces a limit yet; the columns are there for the assessment slice.

1. **Multi-category runs** — is `session_id` grouping acceptable, or do they expect a true
   `assessment_categories` join table? Our recommendation is the former; it respects the given
   diagram. `assessments.session_id` is in the schema and nullable, so either answer is cheap.
2. ~~**Timed assessments**~~ — decided; see above.

Two questions have been added by the build, and both are bigger than the two above:

3. **Authentication.** The product currently signs anyone in with an email address and no
   credential. Is that acceptable through the demo, or does a password check need to land? The
   answer decides whether `users` stays or becomes `profiles` on top of Supabase Auth (deviation
   D1), which is a schema change and not a small one.
4. **RLS.** Same shape of question, same deadline. The policy set is designed (§5) and unapplied.
   Applying it is roughly one migration plus the `answer_options` view; leaving it means the
   database stays publicly writable for the demo.
