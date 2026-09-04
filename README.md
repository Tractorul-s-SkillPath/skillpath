# SkillPath

Assess a skill, find the gaps, work the plan.

A student picks a skill category, takes a multiple-choice assessment, gets a
score with their weak areas identified, and receives a learning plan built from
those weak areas. An admin manages the category catalog and question bank and
sees aggregate data.

Next.js (App Router) · TypeScript · Supabase (Postgres) · Tailwind.

---

## Running it

**1. Install**

```bash
npm install
```

**2. Create a Supabase project** and copy the environment template

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
Project Settings → API Keys, then generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**3. Apply the schema — and this is the step that does not work yet.**

> **There are no migrations in this repository.** No `supabase/` directory, no
> `.sql` file anywhere. The database this app runs against was built by hand in
> the Supabase SQL editor and never written down.
>
> The only in-repo description of it is
> [`lib/supabase/database.types.ts`](lib/supabase/database.types.ts): nine
> tables, four views, two callable functions, eight enums, all hand-written.
> Recreating the database from that file means reading it and typing out the
> DDL yourself, including the constraints and triggers it does not mention.
>
> If you have access to the existing Supabase project, point `.env.local` at it
> and skip this step. If you do not, you cannot currently run this project, and
> **fixing that is the top item in the backlog** — `pg_dump --schema-only`
> against the live project, trimmed, committed as
> `supabase/migrations/0001_init.sql`. See
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §0 and §4.4.

**4. Seed demo content — also not available.**

`package.json` declares `npm run seed` and `npm run seed:users`, and both point
at files in a `scripts/` directory that does not exist. Categories, questions
and accounts are created through the app: register at `/register`, and use the
admin console at `/admin/categories` to build the question bank.

**5. Start**

```bash
npm run dev
```

Sign in at `/login` with the email address of any row in `users`. Any password
— see the note below. To reach the admin side, register a new account, pick
_Administrator_ and tick the manager-approval box, or flip `role` to `'admin'`
on an existing row in the Supabase table editor.

---

## Read this before pointing it at anything real

Two deliberate deferrals, both recorded in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §0 and §5:

- **Sign-in verifies no password.** The field is on the form and is collected
  and discarded. Anyone can sign in as anyone by typing their email address.
- **Row Level Security is off on every table.** The anon key is public by
  design and can read and write the whole database directly, including `users`
  and including `answers.is_correct`, which is the answer key.

Neither is an oversight — both are decisions the team took knowingly and can
revisit. Until they are revisited, treat this database as public.

And one thing that is not a decision, just a gap: **the schema is not in the
repository** (step 3 above). Everything above is recoverable; that one gets
harder every week the live project drifts further from anything written down.

---

## Layout

```
app/            routes. (auth) · (student) · (admin) route groups
components/     shared presentational components; ui/ is the design system
lib/
  domain/       pure functions — scoring, levels, badges, quests. No I/O
  services/     orchestration; the only thing pages call
  repositories/ the only files importing supabase-js
  validation/   Zod schemas, shared client and server
  auth/         session cookie, assertAuth, assertAdmin
  supabase/     the client, and database.types.ts — the schema of record
docs/           ARCHITECTURE.md · BACKLOG.md · TESTING.md
tests/          case sketches. Nothing here runs yet — see docs/TESTING.md
```

`supabase/`, `scripts/` and `e2e/` are referred to in places and do not exist.

Dependencies point downward only: a page never touches a repository, a
repository never calls a service. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
§3 is the rule and it is short.

---

## What is built

**Working end to end:** the landing page, register / sign in / sign out, the
student profile (identity, interests with a level each, assessment history,
learning plan with a status control, XP, badges, quests, leaderboard), the
student dashboard, and the whole admin console — overview tiles, the
weak-categories chart, users, the category catalog, the question bank inside
each category, and the results table, with URL-state filters and server-side
paging throughout.

**Not built:** taking an assessment. `/assessments/new`, `/assessments/[id]`,
`/assessments/[id]/results` and `/plan` render `ComingSoon` — an honest "not
built yet" rather than crashing. Everything downstream of an assessment is
scaffolded for the same reason: scoring, weak areas, plan generation, the
score-trend chart, and all three AI features in `lib/ai/`.

So a member can sign up, describe themselves, and be administered — but cannot
yet be assessed, which is the product.

[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §0 has the full built/not-built
breakdown, and [`docs/BACKLOG.md`](docs/BACKLOG.md) has the stories with their
current status.

---

## Scripts

| Command                               | Does                                                                |
| ------------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                         | Development server                                                  |
| `npm run build`                       | Production build                                                    |
| `npm run start`                       | Serve the production build                                          |
| `npx tsc --noEmit`                    | Typecheck. Passes; run it before you push                           |
| `npm run lint`                        | `next lint` — with no ESLint config, enforces nothing               |
| `npm run seed` · `npm run seed:users` | **Broken.** Both point at files in `scripts/`, which does not exist |

There is no `test` script, because there is no test suite.
`.github/workflows/ci.yml` is a plan, not a pipeline — it has no `on:` and no
`jobs:`, so nothing runs on push and nothing protects `main`. The typecheck is
the only check there is, and it is run by hand.
