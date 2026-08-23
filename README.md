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

**3. Apply the schema.** Paste `supabase/migrations/0001_init.sql` and then
`0002_functions.sql` into the Supabase SQL editor, in that order. With the
Supabase CLI, `supabase db reset` does the same thing. See
[`supabase/README.md`](supabase/README.md) — including how to clear an older
hand-made schema first.

**4. Seed demo content**

```bash
npm run seed
```

Three categories, fifteen questions, and a demo member with graded history, a
learning plan and XP.

**5. Start**

```bash
npm run dev
```

Sign in at `/login` as `student@skillpath.ro`. Any password — see the note
below. To reach the admin side, register a new account and pick
*Administrator*, or run `scripts/promote-admin.sql` against an existing one.

---

## Read this before pointing it at anything real

Two deliberate deferrals, both recorded in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §0 and §5:

- **Sign-in verifies no password.** The field is on the form and is collected
  and discarded. Anyone can sign in as anyone by typing their email address.
- **Row Level Security is off on every table.** The anon key is public by
  design and can read and write the whole database directly, including `users`.

Neither is an oversight — both are decisions the team took knowingly and can
revisit. Until they are revisited, treat this database as public.

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
  supabase/     the client, and the hand-maintained database types
supabase/
  migrations/   THE schema. Numbered, append-only
scripts/        seed.mjs, promote-admin.sql
docs/           ARCHITECTURE.md · BACKLOG.md · TESTING.md
tests/          case sketches. Nothing here runs yet — see docs/TESTING.md
```

Dependencies point downward only: a page never touches a repository, a
repository never calls a service. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
§3 is the rule and it is short.

---

## What is built

The profile page is the one complete vertical slice: identity, interests and
self-declared levels, assessment history, learning plan, XP, badges, quests and
a leaderboard. Auth and the route guards work. The landing page is real.

The dashboard, the plan page, both assessment routes and four of the five admin
pages are `ComingSoon` placeholders — they render an honest "not built yet"
rather than crashing. The AI features in `lib/ai/` are scaffolding.

[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §0 has the full built/not-built
breakdown, and [`docs/BACKLOG.md`](docs/BACKLOG.md) has the stories.

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run seed` | Insert demo content (idempotent) |
| `npx tsc --noEmit` | Typecheck. Passes; run it before you push |

There is no `test` or `lint` script, because there is no test suite and no
ESLint config yet. `.github/workflows/ci.yml` is a plan, not a pipeline —
nothing runs on push.
