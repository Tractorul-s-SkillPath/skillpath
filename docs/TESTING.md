# Testing — SkillPath

> ## Status: not built. This is the plan, not a description.
>
> There is no test runner installed — no Vitest, no Playwright, no
> `vitest.config.ts` — and nothing in `tests/` executes. `package.json` has no
> `test` script.
>
> `tests/` holds ~83 files named `*.test.ts`, each a docblock listing the cases
> it intends to cover with no code beneath it. They are a good specification and
> they are worth keeping. They are not a suite, and the directory listing makes
> it easy to assume otherwise.
>
> Deferred by decision for now. The one consequence worth carrying in your head
> until it changes: the XP amounts and the level thresholds are duplicated
> between `supabase/migrations/0002_functions.sql` and `lib/domain/constants.ts`,
> and nothing checks that the copies agree.
>
> **To pick this up:** install `vitest`, `@vitest/coverage-v8`, `jsdom`,
> `@vitejs/plugin-react` and the Testing Library packages; add
> `vitest.config.ts` with the gate aimed as described below; add `test` and
> `test:coverage` scripts; then turn the docblocks into real cases, starting
> with `lib/domain` because it is pure and needs no database.

## The plan

- **Where tests live:** `tests/` mirrors the source tree one-for-one.
  `lib/domain/scoring.ts` -> `tests/lib/domain/scoring.test.ts`.
- **The gate** (`vitest.config.ts`) counts only `lib/domain/**`, `lib/services/**`,
  `lib/validation/**`. Threshold 75% (ARCHITECTURE §7); we are aiming ~95% on
  `lib/domain` because it is pure and needs no mocks.
- **`lib/repositories`** is integration-tested against a seeded Supabase test
  project and is *excluded* from the gate — do not mock supabase-js.
- **`tests/db/`** asserts the things the database is supposed to guarantee:
  RLS policies, triggers, unique indexes, check constraints.
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
