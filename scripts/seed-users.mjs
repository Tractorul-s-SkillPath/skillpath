/**
 * Seeds the demo accounts — 1 admin, 3 students.
 *
 * Story: SP-102
 *
 *   npm run seed:users
 *
 * Idempotent: accounts are matched on email, and an existing one is left alone
 * rather than overwritten, so re-running never resets a password somebody has
 * since changed.
 *
 * Passwords are scrypt-hashed to the exact format lib/auth/current-user.ts
 * verifies. They are demo credentials for a course project and are printed to
 * the console on purpose — do not point this at anything real.
 */

import { loadEnv, client, hashPassword, must, log } from './lib.mjs';

const PASSWORD = 'skillpath123';

const ACCOUNTS = [
    { first_name: 'Ana',   last_name: 'Ionescu',  email: 'admin@skillpath.test',  role: 'admin'   },
    { first_name: 'Bogdan', last_name: 'Marin',   email: 'bogdan@skillpath.test', role: 'student' },
    { first_name: 'Carmen', last_name: 'Dumitru', email: 'carmen@skillpath.test', role: 'student' },
    { first_name: 'Dan',    last_name: 'Petrescu', email: 'dan@skillpath.test',   role: 'student' },
];

export async function seedUsers(db) {
    const emails = ACCOUNTS.map((a) => a.email);

    const existing = must(
        'Reading existing users',
        await db.from('users').select('user_id, email').in('email', emails),
    );

    const byEmail = new Map(existing.map((row) => [row.email, row.user_id]));
    const missing = ACCOUNTS.filter((a) => !byEmail.has(a.email));

    if (missing.length > 0) {
        const inserted = must(
            'Creating users',
            await db
                .from('users')
                .insert(
                    missing.map((a) => ({
                        ...a,
                        password: hashPassword(PASSWORD),
                        status: 'active',
                    })),
                )
                .select('user_id, email'),
        );

        for (const row of inserted) byEmail.set(row.email, row.user_id);
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
