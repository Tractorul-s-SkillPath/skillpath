/**
 * Shared plumbing for the seed scripts.
 *
 * Story: SP-102
 *
 * These are plain .mjs because they run under bare `node`, outside Next's
 * bundler and outside tsc — so nothing here is typechecked. Keep it boring.
 */

import { readFileSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Reads .env.local into process.env without adding a dotenv dependency.
 *
 * `node --env-file` would do this, but it is a CLI flag and package.json's
 * scripts are the documented entry point — a teammate running `npm run seed`
 * should not have to remember a flag.
 */
export function loadEnv() {
    let raw;

    try {
        raw = readFileSync(path.join(ROOT, '.env.local'), 'utf8');
    } catch {
        fail(
            'No .env.local found.',
            'Copy .env.example to .env.local and fill it in (Supabase dashboard -> Project Settings -> API Keys).',
        );
    }

    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;

        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');

        if (!(key in process.env)) process.env[key] = value;
    }
}

/**
 * The client the seed writes through.
 *
 * Prefers SUPABASE_SERVICE_ROLE_KEY when it is set, because a seed is exactly
 * the kind of privileged batch write a service role is for. It falls back to
 * the anon key, which works today only because this project has RLS disabled
 * (see .env.example). When SP-004 turns RLS on, the fallback stops working and
 * the service role key becomes required — that is the correct failure, and the
 * message below says so rather than leaving someone with a silent empty insert.
 */
export function client() {
    const url = required('NEXT_PUBLIC_SUPABASE_URL');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || required('NEXT_PUBLIC_SUPABASE_ANON_KEY');

    return createClient(url, key, { auth: { persistSession: false } });
}

function required(name) {
    const value = process.env[name];
    if (!value) fail(`Missing ${name}.`, 'Add it to .env.local, then run this again.');
    return value;
}

/**
 * Hashes a password the way lib/auth/current-user.ts does.
 *
 * The format is `salt:key`, scrypt, 64 bytes. verifyPassword() splits on the
 * colon and rejects anything without one, so a seeded plaintext password would
 * produce accounts that exist but can never sign in — which looks like a broken
 * login rather than a broken seed.
 */
export function hashPassword(password) {
    const salt = randomBytes(16).toString('hex');
    return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

/** Aborts with a message a human can act on. Seeds fail loudly or not at all. */
export function fail(what, fix) {
    console.error(`\n  ${what}\n  ${fix}\n`);
    process.exit(1);
}

/** Throws on a PostgREST error so no step silently seeds nothing. */
export function must(step, { data, error }) {
    if (error) fail(`${step} failed: ${error.message}`, 'Nothing was rolled back — re-run once fixed.');
    return data;
}

export const log = (message) => console.log(`  ${message}`);
