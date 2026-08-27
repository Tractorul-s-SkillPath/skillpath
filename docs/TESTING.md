# Testing — SkillPath

> ## Status: not built. This is the plan, not a description.
>
> There is no test runner installed — no Vitest, no Playwright, no
> `vitest.config.ts` — and nothing in `tests/` executes. `package.json` has no
> `test` script.
>
> `tests/` holds 78 files — 69 `*.test.ts` and 9 `*.test.tsx` — each a docblock
> listing the cases it intends to cover with no code beneath it. So are
> `tests/setup.ts` and everything in `tests/helpers/`, which means the
> in-memory repository fakes the service tests below depend on do not exist
> either. `e2e/` does not exist at all. They are a good specification and they
> are worth keeping. They are not a suite, and the directory listing makes it
> easy to assume otherwise.
>
> Deferred by decision for now. Two consequences worth carrying in your head
> until it changes:
>
> - The XP amounts and the level thresholds are duplicated between the database
>   and `lib/domain/constants.ts`, and nothing checks that the copies agree.
>   The SQL half is not in the repository (`docs/ARCHITECTURE.md` §0), so
>   checking it means opening the Supabase SQL editor.
> - Roughly a third of the files here — everything under `tests/lib/domain/`
>   for scoring, weak areas, recommendations and feedback, plus most of
>   `tests/lib/services/` — describe cases for source files that are themselves
>   still comment-only. Writing those tests is blocked on writing the code, not
>   on installing a runner.
>
> **To pick this up:** install `vitest`, `@vitest/coverage-v8`, `jsdom`,
> `@vitejs/plugin-react` and the Testing Library packages; add
> `vitest.config.ts` with the gate aimed as described below; add `test` and
> `test:coverage` scripts; then turn the docblocks into real cases, starting
> with `lib/domain/levels.ts`, `progress.ts` and `gamification.ts` — the three
> that are pure, written, and need no database.

## The plan

- **Where tests live:** `tests/` mirrors the source tree one-for-one.
  `lib/domain/scoring.ts` -> `tests/lib/domain/scoring.test.ts`.
- **The gate** (`vitest.config.ts`) counts only `lib/domain/**`, `lib/services/**`,
  `lib/validation/**`. Threshold 75% (ARCHITECTURE §7); we are aiming ~95% on
  `lib/domain` because it is pure and needs no mocks.
- **`lib/repositories`** is integration-tested against a seeded Supabase test
  project and is *excluded* from the gate — do not mock supabase-js.
- **`tests/db/`** asserts the things the database is supposed to guarantee:
  RLS policies, triggers, unique indexes, check constraints. Note what that
  means today — there is no migration to run against a fresh test project, and
  RLS is off, so these eight files are the ones that would have caught both
  gaps and cannot be written until one of them is closed.
- **Components:** RTL only where there is real logic (assessment run, question
  editor, filters). Static markup is not tested — SP-100 says no tests written
  purely to move the number.
- **E2E:** `e2e/` — Playwright x3, run in CI against the Vercel preview URL.

## What each layer needs

| Layer | Style | Doubles |
|---|---|---|
| `lib/domain` | table-driven, pure | none |
| `lib/services` | behaviour | in-memory repo fakes from `tests/helpers/` |
| `lib/validation` | valid + invalid + boundary per schema | none |
| `lib/repositories` | integration | real test database |
| `app/**/actions.ts` | contract: auth -> zod -> service -> revalidate | service fake |
| `tests/db` | SQL, two tokens (student / admin) | real test database |
