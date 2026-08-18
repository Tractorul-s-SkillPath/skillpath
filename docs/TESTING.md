# Testing — SkillPath

> Stub. Fill as part of SP-100 / SP-103.

## Sketch

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
