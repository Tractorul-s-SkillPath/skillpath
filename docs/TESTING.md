# Testing — SkillPath

> ## Status: running in CI. 32 files, 365 tests, gate green.
>
> ```
> npm test            # watch
> npm run test:run    # once
> npm run test:coverage   # what CI runs
> ```
>
> | | Statements | Branches | Functions | Lines |
> |---|---|---|---|---|
> | **All** | 99.11% | 93.75% | 98.36% | 99.74% |
> | `lib/services` | **100%** | **100%** | **100%** | **100%** |
> | `lib/auth` | **100%** | **100%** | **100%** | **100%** |
> | `lib/validation` | 100% | 75% | 100% | 100% |
> | `lib/domain` | 97.59% | 85.05% | 96.42% | 99.26% |
> | *threshold* | *75* | *70* | *75* | *75* |
>
> `lib/auth` used to read 26% because `session.ts` — HMAC cookie signing — had
> no tests at all. **SP-121 is closed**: it is now the most heavily tested file
> in the project, weighted towards forgery rather than round-tripping, because a
> round-trip test passes against an implementation with no signature. Every
> guard in it was mutation-checked: delete the signature comparison, the expiry
> check, the `typeof` check or the `Number.isFinite` check and a named test
> dies. `current-user.ts` is still excluded from the run and the gate
> (**SP-120**).

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

| Layer | In the gate | Style | Doubles |
|---|---|---|---|
| `tests/lib/domain` | yes | table-driven, pure | none |
| `tests/lib/validation` | yes | valid / invalid / boundary per schema | none |
| `tests/lib/services` | yes | behaviour | repository fakes, see below |
| `tests/lib/auth` | yes | fake session / fake cookie jar | `getCurrentUser`, `next/navigation`, `next/headers` |
| `tests/lib/repositories/paging` | yes | pure | none |
| `tests/lib/repositories/*.repo` | no | integration | real test database |
| `tests/db` | no | SQL: policies, triggers, constraints | real test database |
| `tests/app` | no | action contract + RTL where there is logic | service fake |
| `tests/components` | no | RTL, logic-bearing components only | none |

The last three are **not written yet**. The two database-backed folders are
excluded from the default run so a teammate without a test project can still run
`npm test` on a plane; they will need their own script and their own CI job.

`lib/repositories/paging.ts` is the exception in that folder: three pure
functions and no I/O, so it is in the gate. It is worth more than it looks —
`likeTerm` builds the PostgREST filter string that the admin search box feeds,
and an unquoted comma or bracket there ends the filter clause early and turns
the rest into more filters.

## How service tests substitute repositories

`docs/TESTING.md` used to promise in-memory fakes *injected* into services. That
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
an *orphaned* mirror is invisible, because a docblock-only spec is not in
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

## Known gaps

- **The duplicated constants are still unchecked.** The XP amounts and level
  thresholds exist in both `lib/domain/constants.ts` and
  `0002_functions.sql`, and nothing verifies the copies agree. A test asserting
  `XP_PER_ASSESSMENT === 50` does *not* close this — it compares the constant to
  itself. The check has to read the SQL, which is not in the repository.
  **SP-118**, blocked on SP-003.
- **`lib/domain/derived.ts` is the weakest domain file** at 75% branches. It is
  the largest pure module in the codebase and drives badges, quests and the
  overall level. Its `dayOf` test used to assert only that the output *looked*
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
