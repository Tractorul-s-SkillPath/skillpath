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

`supabase/migrations/` is now the schema, so this folder is no longer the only
in-repo record of what the database enforces. What it still is: the only
**executable** one. A migration says what was applied to some database once;
`constraints.test.ts` asks a live project, by constraint name, what is true
there now. A failure means the project and the migrations have drifted — the
schema was edited in the SQL editor, or a migration was never applied — and that
is worth catching, because `lib/supabase/database.types.ts` is hand-written and
drifts the same way.

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

## The seven RLS files are owed, not blocked

**Both reasons they were blocked are gone.** Row Level Security is enabled on all
ten tables with policies
(`supabase/migrations/20260902204628_securitate_rls.sql`), so there is a policy
set to exercise. And authentication is Supabase Auth rather than a signed cookie
of our own, so there is a real per-user token to hold — "a student's client" and
"an admin's client" are now genuinely different clients, which is the thing that
made these tests impossible to write honestly before.

They are still excluded in `vitest.config.db.ts`. Writing them is the work.

**What is still true, and it is what these files should prove first:
`answers.is_correct` is reachable over PostgREST with the publishable key. The
answer key is obtainable.** RLS did not close this and could not: `answers`
carries one policy, `for select using (true)`, over a blanket `grant all on all
tables in schema public to anon`, and RLS filters rows rather than columns.
`question.service` never selects the column and `response.repo.listForRun` names
its columns to keep it out of the payload — both defeated by one direct request.
SP-004's second acceptance criterion is not satisfied, and the `answer_options`
view that would satisfy it (ARCHITECTURE §5) is in no migration.

## `triggers.test.ts` no longer matches its original spec — and the reason expired

The spec was written for a Supabase Auth schema — `auth.users`,
`raw_user_meta_data`, a row created by trigger on signup, a role-preservation
trigger for SP-013. When this file was written none of that existed, so the
cases had nothing to run against and the file covered the triggers the project
actually had instead.

**Deviation D1 has since been applied.** `public.users.user_id` references
`auth.users(id)`, and `20260904090000_signup_role_from_metadata.sql` is exactly
the signup trigger reading `raw_user_meta_data` that the original spec described
— including the role, which is the SP-013 case. The original cases are now
writable, and the role one is worth writing first: that migration deliberately
lets `/register` create an administrator, and an administrator can read the
answer key.
