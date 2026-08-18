# SkillPath — Architecture Specification

**Status:** proposed, pending mentor check-in
**Team:** 3 engineers · **Build window:** Weeks 3–5 · **Feature freeze:** Week 6

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
| Data + Auth | Supabase (Postgres, GoTrue, RLS) | Mandated; RLS puts authorization *in the database*, where a forgotten `if` can't defeat it |
| Client lib | `@supabase/ssr` | Cookie sessions that work in RSC, actions and middleware |
| UI | Tailwind + shadcn/ui | No design bikeshedding, accessible primitives, editable components |
| Validation | Zod | One schema shared by the client form and the server action |
| Tests | Vitest + RTL, Playwright for 3 happy paths | Mandated; 75% gate on business logic |
| CI/CD | GitHub Actions → Vercel | Push to `main` deploys; PRs get preview URLs |

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
│   ├── supabase/         server.ts client.ts admin.ts database.types.ts
│   ├── validation/       zod schemas, shared client+server
│   └── auth/             assertAuth.ts assertAdmin.ts
├── supabase/migrations/  NNNN_name.sql — append-only
├── docs/                 ARCHITECTURE.md BACKLOG.md TESTING.md
└── e2e/                  Playwright happy paths
```

### The three Supabase clients

| File | Key | Use for |
|---|---|---|
| `lib/supabase/server.ts` | anon + user cookie | **Default.** Everything a user does as themselves; RLS applies |
| `lib/supabase/client.ts` | anon + user session | Only interactive work that must not round-trip |
| `lib/supabase/admin.ts` | **service role** | Grading, aggregates, question-bank writes. Guarded by `assertAdmin()` |

`admin.ts` starts with `import 'server-only'`. If the service-role key ever reaches a client bundle,
the build must fail — that's what the import buys.

---

## 4. Data model

`Diagrama.pdf` is the contract. Six deviations, each with a reason.
**Bring this table to the mentor check-in.**

| # | Diagram says | We propose | Why |
|---|---|---|---|
| D1 | `USER.password string` | Drop it. `profiles.user_id uuid PK → auth.users(id)` | Supabase Auth owns credentials. Our own password column means hashing, resets and lockout are ours to get wrong. `user_id` becomes `uuid` to match `auth.users`. |
| D2 | `selected_answer_id` implicitly required | Nullable + add `position` | Lets us **pre-create one row per question at generation time**. Refresh mid-assessment re-reads the same rows in the same order. Requirement #5 ("the session must be saved") met with **no extra table**. |
| D3 | `ASSESSMENT` has no state | Add `status`, `requested_level`, `submitted_at`, `session_id` | An assessment exists before it's scored. The brief requires selecting *a level*. `session_id` groups a multi-category run (§4.2). |
| D4 | responses store only the choice | Add `is_correct boolean` snapshot | If an admin fixes an answer key next week, a past result must not silently change. Grade once, store the verdict. |
| D5 | `ai_description` only | Split `rule_description` (always set) + `ai_description` (nullable) + `priority` | The plan must render correctly with AI disabled or failing. Rules decide; AI decorates. |
| D6 | `float total_score` | `numeric(5,2)`, 0–100 | Floats compare and print badly. Percentages are exact decimals. |

Plus two small additions: `skill_categories.status` (turns destructive deletes into deactivation)
and `questions.source` (`manual`/`ai`, so the dashboard can show which questions the AI drafted —
cheap, good demo material).

### 4.1 Invariants enforced by the database, not by hope

- **`answers_one_correct_per_question`** — partial unique index: at most one correct answer per
  question. An admin *cannot* save two right answers.
- **`one_active_assessment_per_user_category`** — partial unique on
  `(user_id, category_id) WHERE status='in_progress'`. Two browser tabs cannot start two runs.
- **`assessment_score_present`** — `CHECK ((status='submitted') = (total_score IS NOT NULL))`.
- `UNIQUE (assessment_id, question_id)` and `UNIQUE (assessment_id, position)` on responses.
- `UNIQUE (user_id, category_id)` on `category_progress`.

Each of these is a bug we never have to write a test for.

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

### 4.4 Schema — `supabase/migrations/0001_init.sql`

```sql
create extension if not exists citext;

create type public.user_role         as enum ('student','admin');
create type public.user_status       as enum ('active','inactive');
create type public.skill_level       as enum ('beginner','intermediate','advanced');
create type public.content_status    as enum ('active','inactive');
create type public.assessment_status as enum ('in_progress','submitted','abandoned');
create type public.plan_status       as enum ('not_started','in_progress','completed');

create table public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '' check (length(first_name) <= 60),
  last_name  text not null default '' check (length(last_name)  <= 60),
  email      citext not null unique,
  role       public.user_role   not null default 'student',
  status     public.user_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.skill_categories (
  category_id bigint generated always as identity primary key,
  name        text not null unique check (length(trim(name)) between 2 and 60),
  description text not null default '',
  status      public.content_status not null default 'active',
  created_at  timestamptz not null default now()
);

create table public.questions (
  question_id bigint generated always as identity primary key,
  category_id bigint not null references public.skill_categories(category_id) on delete restrict,
  text        text not null check (length(trim(text)) between 5 and 1000),
  difficulty  public.skill_level    not null,
  status      public.content_status not null default 'active',
  source      text not null default 'manual' check (source in ('manual','ai')),
  created_by  uuid references public.profiles(user_id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on public.questions (category_id, difficulty, status);

create table public.answers (
  answer_id   bigint generated always as identity primary key,
  question_id bigint not null references public.questions(question_id) on delete cascade,
  answer_text text not null check (length(trim(answer_text)) between 1 and 500),
  is_correct  boolean not null default false,
  position    smallint not null default 0
);
create index on public.answers (question_id);
create unique index answers_one_correct_per_question
  on public.answers (question_id) where is_correct;

create table public.assessments (
  assessment_id   bigint generated always as identity primary key,
  user_id         uuid   not null references public.profiles(user_id) on delete cascade,
  category_id     bigint not null references public.skill_categories(category_id) on delete restrict,
  session_id      uuid,
  requested_level public.skill_level not null,
  status          public.assessment_status not null default 'in_progress',
  total_score     numeric(5,2) check (total_score between 0 and 100),
  created_at      timestamptz not null default now(),
  submitted_at    timestamptz,
  constraint assessment_score_present
    check ((status = 'submitted') = (total_score is not null))
);
create index on public.assessments (user_id, created_at desc);
create unique index one_active_assessment_per_user_category
  on public.assessments (user_id, category_id) where status = 'in_progress';

create table public.student_responses (
  student_response_id bigint generated always as identity primary key,
  assessment_id      bigint not null references public.assessments(assessment_id) on delete cascade,
  question_id        bigint not null references public.questions(question_id)     on delete restrict,
  selected_answer_id bigint references public.answers(answer_id) on delete restrict,
  position           smallint not null,
  is_correct         boolean,
  answered_at        timestamptz,
  unique (assessment_id, question_id),
  unique (assessment_id, position)
);

create table public.category_progress (
  progress_id   bigint generated always as identity primary key,
  user_id       uuid   not null references public.profiles(user_id)              on delete cascade,
  category_id   bigint not null references public.skill_categories(category_id)  on delete cascade,
  current_level public.skill_level not null default 'beginner',
  last_score    numeric(5,2),
  updated_at    timestamptz not null default now(),
  unique (user_id, category_id)
);

create table public.recommendation_plans (
  recommendation_id bigint generated always as identity primary key,
  user_id          uuid   not null references public.profiles(user_id)             on delete cascade,
  category_id      bigint not null references public.skill_categories(category_id) on delete cascade,
  assessment_id    bigint references public.assessments(assessment_id) on delete set null,
  topic_title      text not null,
  rule_description text not null default '',
  ai_description   text,
  priority         smallint not null default 3 check (priority between 1 and 5),
  progress_status  public.plan_status not null default 'not_started',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, category_id, topic_title)
);

-- profile auto-created on signup
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, first_name, last_name, email)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'first_name',''),
          coalesce(new.raw_user_meta_data->>'last_name',''),
          new.email);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
```

---

## 5. Security model

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

### Policy sketch — `supabase/migrations/0002_rls.sql`

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
- **Types are generated:** `supabase gen types typescript … > lib/supabase/database.types.ts`,
  committed. Regenerate after every migration.
- **snake_case in SQL, camelCase in TS.** Mapping happens in the repository and nowhere else.
- **Errors:** services return `Result<T, AppError>`, not thrown exceptions across layers. Actions map
  to form state; unexpected throws hit `error.tsx`.
- **`any` is banned.** So is disabling a lint rule without a comment saying why.
- **Branches:** `feat/<slice>-<short>` → PR into `main`, one approval, CI green. Nobody approves
  their own.
- **CI in Week 3, not Week 6:** typecheck → lint → `vitest --coverage` (fails under threshold) →
  `next build`.

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

Both change the schema and are cheapest to decide before any code is written.

1. **Multi-category runs** — is `session_id` grouping acceptable, or do they expect a true
   `assessment_categories` join table? Our recommendation is the former; it respects the given
   diagram.
2. **Timed assessments** — the brief says "timed" but the diagram has no time fields. If timing is
   graded, add `time_limit_seconds` and `started_at` to `assessments` in migration `0001` rather
   than bolting it on in Week 4.
