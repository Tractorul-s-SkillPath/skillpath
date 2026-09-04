# Testing — SkillPath

> ## Status: running in CI. 56 files, 714 tests, gate green.
>
> ```
> npm test            # watch
> npm run test:run    # once
> npm run test:coverage   # what CI runs
> npm run test:db     # the database-backed suite — needs the test project
> ```
>
> | Suite                        | Files | Tests      | Needs a database | CI                                     |
> | ---------------------------- | ----- | ---------- | ---------------- | -------------------------------------- |
> | `npm run test:coverage`      | 44    | 493        | no               | `ci.yml`                               |
> | `npm run test:db`            | 12    | 221        | **yes**          | `db.yml`                               |
> | ↳ `SKILLPATH_DB_TEST_KEEP=1` |       |            |                  | keeps the rows so you can look at them |
> | `npm run test:e2e`           | 2     | 2 journeys | **yes**          | `e2e.yml`                              |
>
> |                  | Statements | Branches | Functions | Lines    |
> | ---------------- | ---------- | -------- | --------- | -------- |
> | **All**          | 99.11%     | 93.75%   | 98.36%    | 99.74%   |
> | `lib/services`   | **100%**   | **100%** | **100%**  | **100%** |
> | `lib/auth`       | **100%**   | **100%** | **100%**  | **100%** |
> | `lib/validation` | 100%       | 75%      | 100%      | 100%     |
> | `lib/domain`     | 97.59%     | 85.05%   | 96.42%    | 99.26%   |
> | _threshold_      | _75_       | _70_     | _75_      | _75_     |
>
> `lib/auth` used to read 26% because `session.ts` — HMAC cookie signing — had
> no tests at all. **SP-121 is closed**: it is now the most heavily tested file
> in the project, weighted towards forgery rather than round-tripping, because a
> round-trip test passes against an implementation with no signature. Every
> guard in it was mutation-checked: delete the signature comparison, the expiry
> check, the `typeof` check or the `Number.isFinite` check and a named test
> dies.
>
> **SP-120 is closed too.** `current-user.ts` — password hashing, password
> verification, and who counts as an administrator — is tested in
> `tests/lib/auth/current-user.test.ts` against the real test project, under
> `npm run test:db`. It stays out of the _gate_ because the gate's suite has no
> database, not because it is untested. Note while reading ARCHITECTURE §0: it
> records this file as signing anyone in on an email alone. That is no longer
> true — passwords are hashed with scrypt and verified — and there is now a test
> that keeps it that way.

## The one thing to know before you add a test file

**`vitest.config.ts` lists the folders that hold written tests. It does not glob
`tests/**`.**

`tests/` mirrors the source tree one-for-one and most mirrors are still
docblock-only specs — a written list of cases with no code under it. Vitest
counts a file containing no test as a **failure**, so a broad glob turns every
unwritten spec into a red file and makes "is the suite green" mean nothing. It
did exactly that once: 46 failures out of 64 files.

So when you write the first real test in a folder, add that folder to `include`
in the same commit. When you write a test for a file that is currently excluded
by name, delete its line from `exclude`. Both lists carry a comment saying why
each entry is there.

## Where tests live

`tests/` mirrors the source tree. `lib/domain/scoring.ts` is tested by
`tests/lib/domain/scoring.test.ts`. When you add a source file, add its mirror
in the same commit — a missing mirror is visible at a glance, which is the whole
reason the folder is shaped this way.

## What runs, and what each layer needs

| Layer                           | In the gate | Style                                      | Doubles                                             |
| ------------------------------- | ----------- | ------------------------------------------ | --------------------------------------------------- |
| `tests/lib/domain`              | yes         | table-driven, pure                         | none                                                |
| `tests/lib/validation`          | yes         | valid / invalid / boundary per schema      | none                                                |
| `tests/lib/services`            | yes         | behaviour                                  | repository fakes, see below                         |
| `tests/lib/auth`                | yes         | fake session / fake cookie jar             | `getCurrentUser`, `next/navigation`, `next/headers` |
| `tests/lib/repositories/paging` | yes         | pure                                       | none                                                |
| `tests/lib/repositories/*.repo` | no          | integration                                | real test database                                  |
| `tests/db`                      | no          | SQL: policies, triggers, constraints       | real test database                                  |
| `tests/app`                     | no          | action contract + RTL where there is logic | service fake                                        |
| `tests/components`              | no          | RTL, logic-bearing components only         | none                                                |
| `e2e`                           | no          | one whole journey, in a browser            | none — a real test project                          |

`tests/app` and `tests/components` are **not written yet** — see "What is still
owed" below.

The database-backed files are excluded from the default run so a teammate
without a test project can still run `npm test` on a plane. **They now have
their own script and their own CI job**, which this paragraph promised for some
time before either existed: `npm run test:db`, driven by `vitest.config.db.ts`,
in `.github/workflows/db.yml`. It shares the E2E project and the E2E secrets.

Nothing there depends on the seed: every test creates the rows it needs through
`Sandbox` and deletes exactly those, so the suite leaves the project as it found
it and two runs cannot collide over fixtures.

`e2e` **is** written, and has both — `npm run test:e2e` and
`.github/workflows/e2e.yml`. It is the one place a real browser and a real
database meet; see below.

`lib/repositories/paging.ts` is the exception in that folder: three pure
functions and no I/O, so it is in the gate. It is worth more than it looks —
`likeTerm` builds the PostgREST filter string that the admin search box feeds,
and an unquoted comma or bracket there ends the filter clause early and turns
the rest into more filters.

## How service tests substitute repositories

`docs/TESTING.md` used to promise in-memory fakes _injected_ into services. That
is not what happens, because services do not take their repositories as
arguments — each one reaches for a module namespace:

```ts
import * as planRepo from '../repositories/plan.repo';
```

and `lib/repositories/types.ts`, where those interfaces were meant to live, is
still comment-only. There is nothing to inject into. Making it true would mean
changing the signature of all eight services and every Server Action that calls
them, as a refactor of working production code.

So the substitution happens at the module boundary instead:

```ts
vi.mock('../../../lib/repositories/plan.repo');
vi.mock('../../../lib/supabase/server', () => ({
  createClient: vi.fn(async () => FAKE_CLIENT),
}));
```

**The rule that mattered is unchanged: no test mocks supabase-js.** No test in
this suite knows what a PostgREST filter chain looks like. `FAKE_CLIENT` is
deliberately opaque — if a service ever calls a method on it, the test fails
with "not a function", which is the signal that query building has leaked out of
the repository layer. When the repositories grow real interfaces, the fakes in
`tests/helpers/in-memory-repos.ts` become the injected implementations with
their bodies unchanged.

`tests/helpers/` holds:

- **`builders.ts`** — `aPlanItem({ status: 'completed' })` and friends. Every
  builder returns a valid, boring instance and takes overrides, so a test names
  only the field it is actually about.
- **`in-memory-repos.ts`** — `FAKE_CLIENT`, `aRepoFailure()`, and the stateful
  `createPlanRepo()` fake.
- **`server-only.ts`** — see below.

## Two environment details

**`server-only`.** Every service opens with `import 'server-only'`, which throws
outside a React Server Component graph — Vitest resolves the package's default
entry, not its `react-server` one. `vitest.config.ts` aliases it to an empty
module so the service layer can be imported at all. This does not weaken
anything: the real package is still what `next build` resolves, so a service
leaking into a client component still fails the build.

**`environment: 'node'`.** Pure functions and Zod schemas need no DOM, and
starting jsdom for all of them cost about 30 seconds a run against 300ms of
actual assertions. A component test opts in per file:

```ts
// @vitest-environment jsdom
```

Nothing has needed that yet, and it will not work until `@testing-library/react`
and `@vitejs/plugin-react` are installed — neither is, so the first component
test starts by adding them.

## End to end (SP-101)

```bash
npm run test:e2e        # build + start + one journey, ~3 min
npm run test:e2e:dev    # dev server instead, for writing one
```

One spec, `e2e/baseline-journey.spec.ts`: register → baseline → results → plan,
one member, one continuous path. `e2e/README.md` is the setup; what belongs
_here_ is why the suite has one of these and not thirty.

**It exists for three failures that are invisible from `npm test`**, and every
step in it earns its place against one of them:

- **`grade_assessment()` returning the wrong score.** The scoring is
  `SECURITY DEFINER` SQL, because the answer key must not travel. So
  `grading.service.test.ts` can only assert the RPC is _called_ — the fake
  returns whatever it is handed. The journey answers a known 12 of 20 and pins
  `60%` exactly, then checks the per-band breakdown separately: the score comes
  from `assessments.total_score` and the bands from the `is_correct` snapshots,
  two writes of the same RPC, and they must agree.
- **A session cookie nobody verifies.** `middleware.ts` checks only that the
  cookie is _present_ — deliberately, it cannot do better on the Edge runtime.
  So the last step forges the signature and expects `/login`. Without it, a
  build that skipped the HMAC comparison would pass this file end to end, and
  `session.test.ts` cannot see the cookie actually being set by a real response.
- **The plan quietly not being written.** `grading.service` catches a failed
  plan write and logs it, on purpose: the run is graded and paid by then, and a
  plan failure must not turn a success into an error. The cost of that decision
  is that the failure is invisible to every caller — HTTP 200, right score, no
  plan. Only rendered rows catch it, which is why the journey ends on `/plan`.

**Two rules that are specific to this folder:**

- **Its own Supabase project, and a guard that enforces it.**
  `e2e/helpers/env.ts` compares the URL in `.env.e2e` against `.env.local` and
  refuses to start if they match — the same rule `tests/db/README.md` states.
  `playwright.config.ts` never reuses a running server and never uses port 3000,
  because a dev server left open is pointed at the demo project.
- **A fresh member every run, unique in email _and_ name.** Not tidiness:
  `loginAction` rejects a duplicate of either, and the baseline is one attempt
  per member — a fixture account could take this journey exactly once.

**Keep it to a few whole journeys.** A step here costs a database round trip and
a browser; a second spec is worth writing when it reaches a path this one cannot
(the admin's question-bank round trip is the obvious candidate), never to
re-check something a service test already pins.

## Deliberately not tested

Four source files have no mirror at all — `lib/domain/types.ts`,
`lib/repositories/types.ts`, `lib/supabase/database.types.ts` and
`lib/supabase/server.ts`. Each is a decision; if you add a fifth, record it here
with a reason.

This list used to name six, and three of the entries were for files that no
longer exist (`lib/supabase/client.ts`, `lib/supabase/middleware.ts`, and
`lib/supabase/admin.ts`, which had a mirror of its own at
`tests/lib/supabase/admin.test.ts`). **The mirror scheme only runs one way.** A
missing mirror is obvious at a glance, which is the point of the folder shape;
an _orphaned_ mirror is invisible, because a docblock-only spec is not in
`include` and so never fails. Deleting a source file therefore leaves a test
file behind silently. The cheap check:

```bash
# tests/db is excluded on purpose: it tests policies, triggers and constraints,
# which are SQL objects and have no source file to mirror.
find tests -name '*.test.ts*' -not -path 'tests/db/*' | while read t; do
  b=${t#tests/}; b=${b%.test.*}
  [ -f "$b.ts" ] || [ -f "$b.tsx" ] || echo "orphan: $t"
done
```

Beyond those, `vitest.config.ts` excludes named files for two different reasons:

- **Source is still comment-only** — `scoring`, `weak-areas` and `feedback` in
  `lib/domain`; `ai`, `auth` and `progress` in `lib/services`. The spec is
  written, the function is not. Delete the exclude line when the code lands.
- **Cannot be tested this way** — `tests/lib/auth/current-user.test.ts`.
  `lib/auth/current-user.ts` builds its own supabase-js queries instead of going
  through a repository, and mocking supabase-js is ruled out. It is testable
  against a real test database, or after its data access moves behind
  `user.repo`. Tracked as **SP-120**.

## What is still owed

|                                                                       | Why                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/components` (5 files) and the 4 `.tsx` files under `tests/app` | neither `@testing-library/react` nor `@vitejs/plugin-react` is installed, so a `.tsx` test cannot run at all. The first component test starts by adding them. The nine `.ts` **Server Action** specs under `tests/app` are now written — they substitute the service, so they need no React and no database |
| `tests/app/(student)/assessments/start/[categoryId]/page.test.ts`     | its source is a server component that finds-or-creates a run and redirects; needs the service mocked and a throwing `redirect`                                                                                                                                                                              |
| `tests/lib/ai` (6 files)                                              | `lib/ai/` is six comment-only files — no implementation to call                                                                                                                                                                                                                                             |
| `tests/lib/domain/{scoring,weak-areas,feedback}`                      | same: written spec, no function                                                                                                                                                                                                                                                                             |
| `tests/lib/services/{ai,auth,progress}`                               | same                                                                                                                                                                                                                                                                                                        |
| `tests/lib/repositories/progress.repo`                                | same                                                                                                                                                                                                                                                                                                        |
| `tests/lib/logger` and `tests/middleware`                             | `lib/logger.ts` is comment-only; `middleware.ts` is real and its test is simply unwritten                                                                                                                                                                                                                   |
| `tests/db/rls-*` (7 files)                                            | **blocked on the product.** RLS is not enabled on any table, so there are no policies to exercise and no user token to hold. See `tests/db/README.md`                                                                                                                                                       |

Everything above except the last two rows is blocked on source that does not
exist yet, not on test effort.

## Known gaps

- **SP-118 is closed, and it found a real divergence.** The XP amounts and level
  thresholds exist in both `lib/domain/constants.ts` and the SQL. A test
  asserting `XP_PER_ASSESSMENT === 50` does _not_ close this — it compares the
  constant to itself, and the check was recorded here as blocked on the
  migration not being in the repository.

  `tests/db/triggers.test.ts` closes it the other way round: it grades real
  papers at known scores and compares what the database **wrote** against what
  the constants **claim**. That needs no migration to read, because it asks the
  authority directly.

  Two results:

  - **Levels agree.** `level_for_score()` in SQL and `estimateLevel()` in
    TypeScript match at 0, 40, 50, 70, 80 and 100 — including both boundaries.
  - **XP does not.** TypeScript says the submission award is
    `XP_PER_ASSESSMENT + score × XP_PER_SCORE_POINT`. The database pays a flat
    `XP_PER_ASSESSMENT` and nothing per point: a 70% paper and a 0% paper are
    both worth exactly 50 XP. This is user-visible — `lib/domain/derived.ts`
    builds the "Sharp today" quest card from `70 * XP_PER_SCORE_POINT` and
    advertises 70 XP for scoring 70%, which is never awarded. Exactly the
    failure the header of `constants.ts` predicted in writing. The test pins
    current behaviour and says so at length; the fix is a product decision
    (either the SQL starts paying per point, or `XP_PER_SCORE_POINT` and the
    quest that reads it come out of the TypeScript).

- **`listPaged` errors past the last page instead of returning an empty one.**
  Found by `tests/lib/repositories/user.repo.test.ts`. PostgREST answers
  PGRST103 when the offset is past the row count and `fromPostgrestError` has no
  case for it, so the admin gets "Something went wrong. Try again." The header of
  `filters.schema.ts` says clamping `?page=` to 1..10 000 makes a hand-edited
  page number safe; it does not, because safety needs the page to be inside
  _this_ result set. Reachable without touching the URL: page to the end of the
  members list, then narrow the filter. Pinned as-is, in `user.repo.test.ts`.
- **`lib/domain/derived.ts` is the weakest domain file** at 75% branches. It is
  the largest pure module in the codebase and drives badges, quests and the
  overall level. Its `dayOf` test used to assert only that the output _looked_
  like a date (`/^\d{4}-\d{2}-\d{2}$/`), which passes when the function reads
  the server's clock instead of `APP_TIMEZONE` — the one bug that matters, since
  streaks group by this value. It now pins a timestamp that falls on different
  days in UTC and Europe/Bucharest.
- **A passing test is not evidence until it can fail.** Two cases in
  `session.test.ts` were written as `{ userId: NaN }` and passed for the wrong
  reason: `JSON.stringify` emits `{"userId":null}`, so both were silently the
  "no id" case and neither touched `Number.isFinite`. A mutation run found it.
  If a test guards something specific, break that thing once and watch it go
  red — it costs a minute.
- **`trimmedString` and `registerSchema.name` accept blank input**, which then
  fails at the SQL check instead of in the form. Current behaviour is pinned by
  tests tagged `SEE SP-119`; when the minimum lands, those tests flip.

## Rules

- **No test exists purely to move the number** (SP-100). If deleting a test
  would not let a bug through, delete it. This is why
  `tests/lib/domain/constants.test.ts` asserts relationships — bands cover every
  score, labels cover every enum member, the baseline clock matches its
  per-question rate — rather than restating each constant as a literal.
- **Never inline a business constant in a test.** `constants.ts` asks for this
  explicitly. Import `WEAK_AREA_THRESHOLD`; a test hardcoding 60 keeps passing
  after someone moves it to 65.
- **No mocking supabase-js.** In services, substitute the repository. In
  repositories, use the real test database. There is no third option.
- **Assert the precondition before the guard.** A block like
  `if (!parsed.success) { expect(...) }` with nothing asserting the parse failed
  is a test that passes having asserted nothing.
- **Every AC in the backlog maps to at least one assertion here.** The story ids
  in each file header are how we check that during the SP-104 audit.
- **Behaviour, not implementation.** Assert what the caller observes, so a
  refactor that keeps behaviour keeps the tests green.
- **English.** Test names, comments, docblocks — the source and the backlog are
  English and the story ids tie them together.
