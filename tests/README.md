# tests/

Mirrors the source tree one-for-one. `lib/domain/scoring.ts` is tested by
`tests/lib/domain/scoring.test.ts`. When you add a source file, add its mirror
in the same commit — a missing mirror is visible at a glance, which is the whole
reason the folder is shaped this way.

The full picture — how to run it, the current numbers, the environment
decisions — is in `docs/TESTING.md`. This file is the shorter version you need
before adding a test.

## Before you add a test file

**`vitest.config.ts` lists the folders that hold written tests. It does not glob
`tests/**`.** Most mirrors here are still docblock-only specs, and Vitest counts
a file with no test in it as a failure. Add your folder to `include` in the same
commit that gives it its first real test; if the file you are covering is named
in `exclude`, delete that line. Both lists say why each entry is there.

## What counts toward the gate

`vitest.config.ts` measures **`lib/domain/**`, `lib/services/**`,
`lib/validation/**`, `lib/auth/**`** — threshold 75% (ARCHITECTURE §7). We aim
much higher on the first three, which are pure or fake-substitutable and cost
almost nothing to cover.

| Folder | In the gate | Needs a database | Style |
|---|---|---|---|
| `tests/lib/domain` | yes | no | table-driven, no mocks. Target ~95% |
| `tests/lib/services` | yes | no | repository fakes from `helpers/` |
| `tests/lib/validation` | yes | no | valid / invalid / boundary per schema |
| `tests/lib/auth` | yes | no | fake session, fake cookie jar, mocked `next/navigation` |
| `tests/lib/ai` | no | no | mock provider + failure injection |
| `tests/lib/repositories/paging` | yes | no | pure — the one exception in that folder |
| `tests/lib/repositories/*.repo` | no | **yes** | integration |
| `tests/db` | no | **yes** | SQL: policies, triggers, constraints |
| `tests/app` | no | no | action contract + RTL where there is logic |
| `tests/components` | no | no | RTL, logic-bearing components only |

The two database-backed folders run in their own script and their own CI job, so
a teammate without a test project can still run `npm test` on a plane.

## How service tests substitute repositories

Services do **not** take their repositories as arguments — each reaches for a
module namespace (`import * as planRepo from '../repositories/plan.repo'`), and
`lib/repositories/types.ts` is still comment-only, so there is nothing to inject
into. The substitution happens at the module boundary:

```ts
vi.mock('../../../lib/repositories/plan.repo');
vi.mock('../../../lib/supabase/server', () => ({
    createClient: vi.fn(async () => FAKE_CLIENT),
}));
```

The rule that mattered is unchanged: **no test mocks supabase-js.** `FAKE_CLIENT`
is opaque, so a service that calls a method on it fails with "not a function" —
the signal that query building has leaked out of the repository layer. See the
header of `helpers/in-memory-repos.ts` for the full reasoning, and SP-120 for
the refactor that would let these become real injected fakes.

## Deliberately not tested

Four source files have no mirror. Each one is a decision, not an oversight — if
you add a fifth, add it here with a reason:

| File | Why |
|---|---|
| `lib/domain/types.ts` | type declarations, no runtime |
| `lib/repositories/types.ts` | interfaces only — `tests/helpers/in-memory-repos.ts` is what proves they are implementable |
| `lib/supabase/database.types.ts` | hand-written row types; a migration and that file change in the same commit |
| `lib/supabase/server.ts` | a ~5-line factory around `@supabase/ssr`; testing it tests the library |

**Orphaned mirrors are invisible — check for them.** This table used to list
`lib/supabase/client.ts` and `lib/supabase/middleware.ts`, neither of which
exists any more, and `tests/lib/supabase/admin.test.ts` sat here for a source
file that had been deleted. A docblock-only spec is not in `include`, so it
never fails; deleting a source file leaves its test behind in silence. The
folder shape catches a *missing* mirror at a glance and an *orphaned* one not at
all:

```bash
# tests/db is excluded on purpose: it tests policies, triggers and constraints,
# which are SQL objects and have no source file to mirror.
find tests -name '*.test.ts*' -not -path 'tests/db/*' | while read t; do
  b=${t#tests/}; b=${b%.test.*}
  [ -f "$b.ts" ] || [ -f "$b.tsx" ] || echo "orphan: $t"
done
```

One file has a mirror that is excluded rather than absent, which means something
different — the test is owed, not waived:

| File | Why | Story |
|---|---|---|
| `lib/auth/current-user.ts` | builds its own supabase-js queries instead of going through a repository, and mocking supabase-js is ruled out | SP-120 |

`lib/auth/session.ts` used to sit in that table as well. **SP-121 is closed** —
see `session.test.ts`, and note that it is weighted towards forgery rather than
round-tripping, because a round-trip test passes against an implementation with
no signature at all.

## Rules

- **No test exists purely to move the number** (SP-100). If deleting a test
  would not let a bug through, delete it.
- **Never inline a business constant.** `constants.ts` asks for this explicitly.
  Import `WEAK_AREA_THRESHOLD`; a test hardcoding 60 keeps passing after someone
  moves it to 65.
- **No mocking supabase-js.** In services, substitute the repository. In
  repositories, use the real test database. There is no third option.
- **Assert the precondition before the guard.** A block like
  `if (!parsed.success) { expect(...) }` with nothing asserting the parse failed
  is a test that passes having asserted nothing.
- **Distinguish "it failed" from "it isn't there."** A repository returning an
  error is not a missing row, and a service that reports one as the other tells
  a member their work is gone. Every `if (!x.ok) return err(x.error)` deserves a
  case.
- **Every AC in the backlog maps to at least one assertion here.** The story ids
  in each file header are how we check that during the SP-104 audit.
- **Behaviour, not implementation:** assert what the caller observes, so a
  refactor that keeps behaviour keeps the tests green. In particular, key a mock
  on its *arguments*, not on call order — `mockResolvedValueOnce` chains encode
  the order a service happens to call something in, and break on a refactor that
  changes nothing.
- **English.** Test names, comments, docblocks.
