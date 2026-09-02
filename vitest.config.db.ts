/**
 * Vitest config for the database-backed tests — the SP-004 job.
 *
 * Stories: SP-004, SP-005
 *
 *     npm run test:db
 *
 * `vitest.config.ts` EXCLUDES everything this file includes, and that split is
 * the point: a teammate without a test project runs `npm test` on a plane and
 * gets a green suite. Both `tests/README.md` and `docs/TESTING.md` described
 * this script and its CI job as though they existed; until now neither did, so
 * the two folders they name were excluded from the only runner there was and
 * ran nowhere at all.
 *
 * THREE SETTINGS BELOW ARE LOAD-BEARING:
 *
 * 1. `fileParallelism: false`. One hosted database, and the fixtures are not
 *    fully independent of each other: `one_active_assessment_per_user_category`
 *    is a partial unique index across the whole table, so two files opening a
 *    run for the same (user, category) collide even though neither shares a
 *    row. Sandboxes make that rare; serial execution makes it impossible.
 *
 * 2. No `coverage`. Coverage belongs to `vitest.config.ts`, which measures
 *    lib/domain, lib/services, lib/validation and lib/auth. Measuring the
 *    repository layer here as well would report two unrelated numbers for one
 *    codebase and leave nobody sure which is "the" coverage.
 *
 * 3. `testTimeout`. Every assertion is a round trip to a hosted project, and
 *    Vitest's 5s default fails a healthy suite on a slow connection — which
 *    reads as a broken repository rather than a slow network.
 */

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    test: {
        environment: 'node',
        setupFiles: ['./tests/setup.ts'],
        include: [
            'tests/db/**/*.test.ts',
            'tests/lib/repositories/*.repo.test.ts',
            // Needs the database for the same reason the repositories do: it
            // builds its own supabase-js queries rather than going through one
            // (SP-120), and tests/README.md rules out mocking supabase-js.
            'tests/lib/auth/current-user.test.ts',
        ],
        exclude: [
            // The source is still comment-only — a sketch of upsert/listForUser
            // /scoreTrend with no function to call. Delete this line when
            // lib/repositories/progress.repo.ts grows a body.
            'tests/lib/repositories/progress.repo.test.ts',

            // ---------------------------------------------------------------
            // THE SEVEN RLS SPECS. Blocked on the product, not on effort.
            //
            // Row Level Security is not enabled on any table in this project
            // and there are no policies to exercise (ARCHITECTURE §0: "RLS is
            // off on every table and the anon key — which is public by design —
            // can read and write all of them"). The policy set is designed in
            // §5 and unapplied; it would land as 0003_rls.sql, which is itself
            // blocked on 0001 and 0002 not existing either.
            //
            // So these seven are not unwritten. They are unwritable: every case
            // in them ("student X selecting student Y's rows -> 0 rows", "a
            // student cannot insert a category", "GET answers?select=is_correct
            // with a student token -> 401") asserts a boundary that is not
            // there, and each one would fail by returning the data it is
            // checking cannot be returned.
            //
            // They also cannot be written honestly a different way. There is no
            // student token to hold — authentication is a signed cookie of our
            // own, not GoTrue — so "a student's client" and "an admin's client"
            // would both be the same anon key with a label on it, and an
            // assertion written against that passes for the wrong reason.
            //
            // WHAT IS ACTUALLY TRUE TODAY, and worth stating plainly because
            // the spec files read as though it were handled: anybody holding
            // the publishable key can read `answers.is_correct` over PostgREST.
            // The answer key is obtainable. question.service is careful never
            // to select the column and response.repo.listForRun names its
            // columns to keep it out of the payload — both of which are
            // defeated by one direct request. SP-004 AC2 is not satisfied.
            //
            // Excluded rather than deleted: they are the correct list of cases
            // and they are what 0003_rls.sql should be written against. Delete
            // this block when RLS lands, and they become the tests that prove
            // it.
            // ---------------------------------------------------------------
            'tests/db/rls-assessments.test.ts',
            'tests/db/rls-categories.test.ts',
            'tests/db/rls-plans.test.ts',
            'tests/db/rls-profiles.test.ts',
            'tests/db/rls-progress.test.ts',
            'tests/db/rls-questions-answers.test.ts',
            'tests/db/rls-responses.test.ts',
        ],
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 30_000,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
            // Every repository opens with `import 'server-only'`, which throws
            // outside a React Server Component graph. Same alias, same reason,
            // as vitest.config.ts — without it the repository layer cannot be
            // imported at all and every file here fails on line one.
            'server-only': path.resolve(__dirname, './tests/helpers/server-only.ts'),
        },
    },
});
