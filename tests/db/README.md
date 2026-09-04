# tests/db

What the **database** guarantees, asserted against the real Supabase test
project.

```bash
npm run test:db     # this folder + tests/lib/repositories/*.repo + current-user
```

Run separately from `npm test` — they need a database, so they have their own
script (`vitest.config.db.ts`) and their own CI job
(`.github/workflows/db.yml`). Never point them at the demo project;
`tests/helpers/supabase-test-client.ts` compares the URL against `.env.local`
and refuses to start if they match.

## Why this folder is worth more than its size suggests

There are no migrations in the repository. The live schema was applied by hand
in the SQL editor and `lib/supabase/database.types.ts` is the only in-repo
description of it (ARCHITECTURE §0 calls this "the largest single gap in the
project"). So `constraints.test.ts` is not really checking that Postgres
enforces constraints — it is **the repository's only executable record of which
constraints exist**, by name. A failure means the two projects have drifted,
which is exactly what a missing migration makes likely.

`triggers.test.ts` covers the rows no repository writes: `category_progress` and
`xp_events` are written by the database on grading, and `completed_at` by a
trigger on plan completion. Nothing in `npm test` can see any of them.

## What is here

| File                  |                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `constraints.test.ts` | 41 cases — every check, unique index, foreign key and enum, asserted by constraint name                                             |
| `triggers.test.ts`    | grading writes `category_progress` and `xp_events`; plan completion stamps `completed_at` and pays once; `updated_at` is maintained |
| `rls-*.test.ts` (7)   | **Blocked, not unwritten.** See below                                                                                               |

## Seeing what a run actually did

The suite is invisible in the Supabase table editor by design — it writes
hundreds of rows and removes every one, so the project after a run is identical
to the project before it. Right for CI, useless when you want to look:

```bash
SKILLPATH_DB_TEST_KEEP=1 npm run test:db -- tests/lib/repositories/plan.repo.test.ts
```

Everything that file created stays, tagged with its sandbox name, and the run
prints the ids. Search Supabase for the tag (`Sbx <tag>`, or the tag alone in
`users.last_name`) to find them.

Prefer one file to the whole suite: 221 tests' worth of kept rows is a lot to
read and a lot to remove afterwards.

**Kept rows do not clean themselves up.** A later run uses a new tag, so it will
not touch them, and a leftover category is ACTIVE and shows on every student's
`/assessments` page. Remove them in the SQL editor when you are done:

Every sandbox names its rows the same way: categories are `Sbx <tag>-<n>` and
members carry `<tag>-<n>` in `last_name`, so one tag finds all of them. Replace
`plan-repo-mtkib4hn-uydi2m` below with the tag the run printed — or use
`Sbx %` / `%-repo-%` to sweep up every sandbox at once.

```sql
-- Child rows first. skill_categories.category_id is ON DELETE RESTRICT, so the
-- last statement fails unless the questions and assessments are gone already.
with sbx as (select category_id from skill_categories where name like 'Sbx %'),
     mem as (select user_id from users where last_name like '%-repo-%'
                                          or last_name like '%constraints-%'
                                          or last_name like '%triggers-%')
delete from student_responses
 where assessment_id in (select assessment_id from assessments where user_id in (select user_id from mem))
    or question_id   in (select question_id   from questions   where category_id in (select category_id from sbx));

delete from xp_events            where user_id     in (select user_id from users where last_name like '%-repo-%');
delete from recommendation_plans where category_id in (select category_id from skill_categories where name like 'Sbx %');
delete from assessments          where category_id in (select category_id from skill_categories where name like 'Sbx %');
delete from category_progress    where category_id in (select category_id from skill_categories where name like 'Sbx %');
delete from answers              where question_id in (select question_id from questions where category_id in (select category_id from skill_categories where name like 'Sbx %'));
delete from questions            where category_id in (select category_id from skill_categories where name like 'Sbx %');
delete from skill_categories     where name like 'Sbx %';
delete from users                where last_name like '%-repo-%' or last_name like '%constraints-%' or last_name like '%triggers-%';
```

Same idea as `E2E_CLEAN=1` in the Playwright suite, pointed the other way: that
one opts _in_ to cleaning because keeping is its default; this one opts _out_.

## Fixtures

`Sandbox`, from `tests/helpers/supabase-test-client.ts`. Each test creates only
the rows it needs — uniquely tagged — and `destroy()` removes exactly those in
foreign-key order. Nothing truncates and nothing writes to the seeded bank, so
this suite leaves the project exactly as it found it and needs no reseed
between runs.

Teardown is deliberately **not** best-effort: a leftover `skill_categories` row
is active and shows up on every student's `/assessments` page, so `destroy()`
reports what it could not delete and names the id.

## The seven RLS files are blocked on the product

They describe policies that do not exist. **Row Level Security is not enabled on
any table** — the anon key, which is public by design, can read and write all of
them (ARCHITECTURE §0). The policy set is designed in §5 and unapplied.

They are also not writable a different way. There is no student token to hold:
authentication is a signed cookie of our own rather than GoTrue, so "a student's
client" and "an admin's client" would both be the same anon key wearing a label,
and an assertion against that passes for the wrong reason.

**What is true today, stated plainly because those files read as though it were
handled: `answers.is_correct` is reachable over PostgREST with the publishable
key. The answer key is obtainable.** `question.service` never selects the column
and `response.repo.listForRun` names its columns to keep it out of the payload —
both defeated by one direct request. SP-004 AC2 is not satisfied.

They are excluded in `vitest.config.db.ts`, with that reasoning recorded there,
rather than deleted: they are the right list of cases and they are what
`0003_rls.sql` should be written against. When RLS lands, delete the exclude
block and they become the tests that prove it.

## `triggers.test.ts` no longer matches its original spec, on purpose

The spec was written for a Supabase Auth schema — `auth.users`,
`raw_user_meta_data`, a `profiles` row created by trigger, a role-preservation
trigger for SP-013. None of that exists (deviation D1 was never applied). Those
cases are not failing; they have nothing to run against. The file now covers the
triggers this project actually has, which were equally untested.
