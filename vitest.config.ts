/**
 * Vitest config — the coverage gate lives here.
 *
 * Stories: SP-005, SP-100
 *
 * TWO SETTINGS BELOW ARE LOAD-BEARING AND LOOK LIKE BOILERPLATE:
 *
 * 1. `include` names the folders that actually hold written tests. It used to
 *    be `tests/**\/*.test.ts?(x)`, which is wrong here: tests/ mirrors the
 *    source tree one-for-one and most mirrors are still docblock-only specs,
 *    and Vitest counts a file containing no test as a FAILURE. The broad glob
 *    turned 46 unwritten specs into 46 red files, which made "is the suite
 *    green" mean nothing. Add your folder to this list in the same commit that
 *    gives it its first real test.
 *
 * 2. `coverage.include` ends in `*.ts`. `lib/domain/**` also matches
 *    lib/domain/README.md; the v8 provider tries to parse it as JavaScript,
 *    throws, and aborts report generation — so the thresholds never run and no
 *    coverage number is printed at all.
 *
 * The gate is switched on in Slice 0, not in Week 6 (risk table, ARCHITECTURE §10).
 */

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    test: {
        // Pure functions and Zod schemas need no DOM. A component test opts in
        // per file with `// @vitest-environment jsdom`, which keeps the ~30s
        // jsdom startup off the tests that never touch a document.
        environment: 'node',
        setupFiles: ['./tests/setup.ts'],
        include: [
            'tests/lib/domain/**/*.test.ts',
            'tests/lib/validation/**/*.test.ts',
            'tests/lib/services/**/*.test.ts',
            'tests/lib/auth/**/*.test.ts',
            'tests/lib/errors.test.ts',
            'tests/lib/result.test.ts',
            'tests/lib/utils.test.ts',
        ],
        exclude: [
            // Need a live Supabase test project — separate script, own CI job.
            'tests/db/**',
            'tests/lib/repositories/**',
            // Inside the domain glob above, but the source is still
            // comment-only: scoring.ts, weak-areas.ts and feedback.ts have a
            // written spec and no function to call. Delete a line here when the
            // function it names lands.
            'tests/lib/domain/scoring.test.ts',
            'tests/lib/domain/weak-areas.test.ts',
            'tests/lib/domain/feedback.test.ts',
            // Same again for the service layer: ai, auth and progress are
            // comment-only files with no function to call.
            'tests/lib/services/ai.service.test.ts',
            'tests/lib/services/auth.service.test.ts',
            'tests/lib/services/progress.service.test.ts',
            // Different reason: lib/auth/current-user.ts builds its own
            // supabase-js queries instead of going through a repository, and
            // tests/README.md rules out mocking supabase-js. It is testable
            // against a real test database or after its data access moves
            // behind user.repo — see SP-120. Not testable from here.
            'tests/lib/auth/current-user.test.ts',
        ],
        coverage: {
            provider: 'v8',
            include: [
                'lib/domain/**/*.ts',
                'lib/services/**/*.ts',
                'lib/validation/**/*.ts',
                // Added to the gate once assertAuth and assertAdmin had tests:
                // they are the first line of every protected page and action,
                // and coverage nobody measures is coverage that rots.
                'lib/auth/**/*.ts',
            ],
            exclude: [
                // Type declarations, no runtime. tests/README.md lists this as
                // a deliberate non-target rather than an oversight.
                'lib/domain/types.ts',
                // Untestable from here until its data access moves behind a
                // repository — see SP-120 and the exclude entry above. Counting
                // it would mean the gate measures a file we have decided not to
                // test yet.
                'lib/auth/current-user.ts',
            ],
            thresholds: {
                lines: 75,
                functions: 75,
                branches: 70,
                statements: 75,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
            // Every service opens with `import 'server-only'`, which throws
            // outside a React Server Component graph — Vitest resolves the
            // package's default entry, not its react-server one. Aliasing it to
            // an empty module lets the service layer be imported at all. It is
            // a test-environment concern only: the real guard still applies to
            // every build Next.js makes.
            'server-only': path.resolve(__dirname, './tests/helpers/server-only.ts'),
        },
    },
});
