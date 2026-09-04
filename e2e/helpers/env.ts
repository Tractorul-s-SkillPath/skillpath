/**
 * The test project's credentials — and the guard that keeps them pointed at it.
 *
 * Story: SP-101
 *
 * Read from `.env.e2e`, which is gitignored like every other `.env.*`. In CI
 * there is no file and the values arrive as secrets, so a missing file is not
 * an error here; a missing *value* is.
 *
 * THE GUARD IS THE POINT OF THIS FILE. tests/db/README.md puts it plainly: if
 * these tests can reach the project the demo runs on, that is the incident, not
 * the test failure. This journey registers members, grades papers and writes
 * plan rows — pointed at the demo project it would quietly fill it with
 * `e2e-*@skillpath.test` accounts. So the URL is compared against `.env.local`
 * and refuses to match it.
 *
 * A guard on the URL only proves the *harness* is aimed correctly. What proves
 * the SERVER is aimed correctly is in the journey itself: it registers through
 * the browser and then looks the new row up through this client. Same project
 * or the test fails on step two.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

export interface E2eEnv {
    supabaseUrl: string;
    supabaseKey: string;
    /**
     * Reads and writes go through this, not `supabaseKey`. RLS is on in the
     * test project, and the anon role satisfies no policy — the harness saw an
     * empty `skill_categories` and reported "the E2E project has no category 0"
     * about a project that was fully seeded.
     */
    serviceRoleKey: string;
    port: number;
    baseURL: string;
}

/**
 * Reads a `.env`-shaped file into a plain object. Same five lines as
 * `scripts/lib.mjs`, and for the same reason: no dotenv dependency for
 * something this small.
 */
function readEnvFile(file: string): Record<string, string> {
    let raw: string;

    try {
        raw = readFileSync(path.join(ROOT, file), 'utf8');
    } catch {
        return {};
    }

    const values: Record<string, string> = {};

    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;

        values[trimmed.slice(0, eq).trim()] = trimmed
            .slice(eq + 1)
            .trim()
            .replace(/^["']|["']$/g, '');
    }

    return values;
}

function missing(name: string): never {
    throw new Error(
        `Missing ${name} for the E2E run.\n\n` +
            'Copy the block at the bottom of skillpath/.env.example into skillpath/.env.e2e and\n' +
            'fill it in from the Supabase dashboard of the TEST project (Project Settings ->\n' +
            'API Keys). In CI the same names come from repository secrets.',
    );
}

let cached: E2eEnv | null = null;

export function e2eEnv(): E2eEnv {
    if (cached) return cached;

    const file = readEnvFile('.env.e2e');

    // Real environment wins, so CI secrets need no file and a one-off override
    // on the command line works without editing anything.
    //
    // An EMPTY value counts as missing. `.env.e2e` ships with the names present
    // and the values blank, so anything that treats '' as a value hands the
    // empty string to supabase-js and fails with "supabaseUrl is required" from
    // inside a library, twelve frames from the thing to fix.
    const read = (name: string): string | undefined =>
        (process.env[name] || file[name] || '').trim() || undefined;

    const supabaseUrl = read('NEXT_PUBLIC_SUPABASE_URL') ?? missing('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseKey =
        read('NEXT_PUBLIC_SUPABASE_ANON_KEY') ?? missing('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    const serviceRoleKey =
        read('SUPABASE_SERVICE_ROLE_KEY') ?? missing('SUPABASE_SERVICE_ROLE_KEY');
    // SESSION_SECRET IS NO LONGER READ, AND IS NO LONGER REQUIRED.
    //
    // It signed `skillpath_session`, the app's own HMAC session cookie. The
    // session is Supabase's now, carried in `sb-*-auth-token` and signed with a
    // key that never leaves the project — so lib/auth/session.ts is deleted and
    // nothing consumes this value.
    //
    // It is deliberately not merely ignored: this function used to THROW when
    // it was missing or shorter than 32 characters, which would have blocked
    // every first run on a secret that does nothing. Deleting the check is the
    // point; the name stays in the workflows only until the repository secret
    // is removed too.

    const demo = readEnvFile('.env.local');
    const demoUrl = demo.NEXT_PUBLIC_SUPABASE_URL;

    // The URL guard below proves the HARNESS is aimed correctly. It does not
    // prove the SERVER is: `next start` loads .env.local, so the app under test
    // takes SUPABASE_SERVICE_ROLE_KEY from there unless playwright.config.ts
    // overrides it — pointing a demo-project key at a test-project URL. That
    // combination fails as "Invalid API key", and if the two ever did match it
    // would write the journey's rows into the demo project. A service-role key
    // is the one credential that can do that through RLS, so it gets its own
    // check rather than riding on the URL's.
    if (demo.SUPABASE_SERVICE_ROLE_KEY && demo.SUPABASE_SERVICE_ROLE_KEY === serviceRoleKey) {
        throw new Error(
            'REFUSING TO RUN: SUPABASE_SERVICE_ROLE_KEY in .env.e2e is the same key as the one\n' +
                "in .env.local — the demo project's.\n\n" +
                'A service-role key bypasses RLS entirely, so this would let the journey write\n' +
                'into the demo database no matter what the url says.\n\n' +
                "Use the TEST project's service_role key (its own dashboard -> Project Settings\n" +
                '-> API Keys).',
        );
    }

    if (demoUrl && demoUrl === supabaseUrl) {
        throw new Error(
            'REFUSING TO RUN: .env.e2e points at the same Supabase project as .env.local.\n\n' +
                'This journey registers members, grades assessments and writes plan rows. Against\n' +
                'the demo project that is data loss waiting to happen, not a test.\n\n' +
                'Create a second Supabase project and put ITS url and publishable key in .env.e2e.',
        );
    }

    const port = Number(process.env.E2E_PORT ?? 3100);

    cached = {
        supabaseUrl,
        supabaseKey,
        serviceRoleKey,
        port,
        // Deliberately not 3000: a dev server left running on the default port
        // is pointed at .env.local, and reusing it would defeat every guard above.
        //
        // `localhost`, NOT 127.0.0.1, and that is load-bearing under E2E_DEV=1.
        // Next 16's dev server refuses to serve /_next/static/chunks to an
        // origin it does not recognise, and 127.0.0.1 is not localhost to it:
        //
        //   Blocked cross-origin request to Next.js dev resource ... from "127.0.0.1"
        //
        // The page still renders — it is server-rendered — so the failure does
        // not look like a failure. It looks like the client bundle silently not
        // arriving: radios check themselves natively, React never hydrates, the
        // answered counter stays at 0 and no Server Action is ever called.
        // The alternative fix is `allowedDevOrigins` in next.config, which
        // means editing shipped configuration for a test-only concern.
        baseURL: `http://localhost:${port}`,
    };

    return cached;
}
