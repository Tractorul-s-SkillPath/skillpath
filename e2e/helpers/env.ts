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
    sessionSecret: string;
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
    const sessionSecret = read('SESSION_SECRET') ?? missing('SESSION_SECRET');

    if (sessionSecret.length < 32) {
        throw new Error(
            'SESSION_SECRET for the E2E run is shorter than 32 characters, which lib/auth/session.ts\n' +
                'rejects — every page would 500. Generate one with:\n' +
                '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
        );
    }

    const demoUrl = readEnvFile('.env.local').NEXT_PUBLIC_SUPABASE_URL;

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
        sessionSecret,
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
