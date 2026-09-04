/**
 * Seeds the demo accounts — 1 admin, 3 students.
 *
 * Story: SP-102
 *
 *   npm run seed:users
 *
 * ---------------------------------------------------------------------------
 * IT CREATES SUPABASE AUTH ACCOUNTS NOW, NOT `public.users` ROWS.
 * ---------------------------------------------------------------------------
 *
 * It used to insert straight into `public.users` with a scrypt hash in a
 * `password` column. Both halves of that are gone: `user_id` is
 * `uuid references auth.users(id)` with no default, so a profile row cannot be
 * conjured without an account behind it, and there is no password column left
 * to write to. A profile row appears on its own — `on_auth_user_created` writes
 * it from the account's metadata.
 *
 * That is also why the old seed left the E2E project unusable after the auth
 * migration: it filled `public.users` while `auth.users` stayed empty, so every
 * one of these addresses failed `signInWithPassword` with "Invalid login
 * credentials" no matter how many times it was re-run.
 *
 * `auth.admin.createUser` and NOT signUp: the admin API sends no confirmation
 * mail, so seeding costs nothing against the project's ~2/hour SMTP quota, and
 * `email_confirm: true` lets the account sign in the moment it exists.
 *
 * Idempotent: an existing account is left alone rather than overwritten, so
 * re-running never resets a password somebody has since changed.
 *
 * These are demo credentials for a course project and are printed to the
 * console on purpose — do not point this at anything real.
 */

import { loadEnv, client, must, log } from './lib.mjs';

const PASSWORD = 'skillpath123';

const ACCOUNTS = [
    { first_name: 'Ana', last_name: 'Ionescu', email: 'admin@skillpath.test', role: 'admin' },
    { first_name: 'Bogdan', last_name: 'Marin', email: 'bogdan@skillpath.test', role: 'student' },
    { first_name: 'Carmen', last_name: 'Dumitru', email: 'carmen@skillpath.test', role: 'student' },
    { first_name: 'Dan', last_name: 'Petrescu', email: 'dan@skillpath.test', role: 'student' },
];

export async function seedUsers(db) {
    const emails = ACCOUNTS.map((a) => a.email);

    const existing = must(
        'Reading existing users',
        await db.from('users').select('user_id, email').in('email', emails),
    );

    const byEmail = new Map(existing.map((row) => [row.email, row.user_id]));
    const missing = ACCOUNTS.filter((a) => !byEmail.has(a.email));

    // One at a time: the auth admin API has no bulk create, and a failure
    // halfway through should name the address it choked on rather than
    // reporting that "the batch" failed.
    for (const account of missing) {
        const { data, error } = await db.auth.admin.createUser({
            email: account.email,
            password: PASSWORD,
            email_confirm: true,
            user_metadata: {
                first_name: account.first_name,
                last_name: account.last_name,
            },
        });

        if (error) {
            throw new Error(`Creating ${account.email}: ${error.message}`);
        }

        byEmail.set(account.email, data.user.id);

        // The trigger hardcodes 'student' so that no sign-up path can mint an
        // admin. Promoting has to be a separate, deliberate write, and the
        // service-role key is what makes it possible here.
        if (account.role !== 'student') {
            must(
                `Promoting ${account.email} to ${account.role}`,
                await db.from('users').update({ role: account.role }).eq('user_id', data.user.id),
            );
        }
    }

    log(`users: ${missing.length} created, ${ACCOUNTS.length - missing.length} already present`);

    return {
        admin: byEmail.get(ACCOUNTS[0].email),
        students: ACCOUNTS.slice(1).map((a) => byEmail.get(a.email)),
    };
}

// Only run when invoked directly — seed.mjs imports seedUsers() instead.
if (import.meta.url === `file://${process.argv[1]}`) {
    loadEnv();
    await seedUsers(client());

    console.log(`\n  Sign in with any of:\n`);
    for (const a of ACCOUNTS) console.log(`    ${a.email.padEnd(24)} ${PASSWORD}  (${a.role})`);
    console.log();
}
