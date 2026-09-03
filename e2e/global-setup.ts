/**
 * Runs once, before the browser starts. Fails fast and says what to do.
 *
 * Story: SP-101
 *
 * Everything checked here is a *precondition*, not a behaviour: it is about the
 * test project being the right project and holding the seed the journey needs.
 * The distinction matters because a precondition failure and a product failure
 * look identical from a red pipeline, and the first one wastes an afternoon.
 *
 * `startBaseline` refuses a paper shorter than BASELINE_QUESTION_COUNT and
 * redirects to /dashboard, so an unseeded project would surface as "the run
 * never opened" fifteen steps into a journey. Better to say "run
 * npm run seed:e2e" here.
 */

import {
    BASELINE_QUESTION_COUNT,
    GENERAL_KNOWLEDGE_CATEGORY_ID,
} from '../lib/domain/constants';
import { e2eEnv } from './helpers/env';
import { readBaselineAnswerKey, testDb, type TestDb } from './helpers/db';
import { SEEDED_ADMIN } from './helpers/member';

/**
 * Make sure `admin@skillpath.test` exists as a real Supabase Auth account.
 *
 * ---------------------------------------------------------------------------
 * THIS IS THE STEP THE SUITE WAS MISSING, AND IT COST BOTH SPECS.
 * ---------------------------------------------------------------------------
 *
 * The admin used to be a row in `public.users` with a bcrypt hash in a
 * `password` column, written by scripts/seed-users.mjs. Sign-in read that
 * column directly. Now it goes through `signInWithPassword`, which looks only
 * in `auth.users` — and `auth.users` was empty, so admin-question.spec.ts
 * failed on its first step with `/login?error=invalid`, and would have kept
 * failing however many times the profile row was reseeded.
 *
 * `auth.admin.createUser` and NOT signUp: the admin API sends no confirmation
 * mail, so this costs nothing against the project's ~2/hour SMTP quota, and
 * `email_confirm: true` means the account can sign in the moment it exists.
 *
 * The role is set afterwards rather than passed in, because
 * `on_auth_user_created` hardcodes 'student' — deliberately, so that no
 * sign-up path can mint an admin. The service-role client is allowed to
 * override it; nothing reachable from a browser is.
 *
 * Idempotent: an existing account is left alone apart from its password and
 * role being reasserted, so a project whose admin password has drifted from
 * the constant in member.ts repairs itself rather than failing every run.
 */
async function ensureSeededAdmin(db: TestDb): Promise<void> {
    const { data: profile, error } = await db
        .from('users')
        .select('user_id, role')
        .eq('email', SEEDED_ADMIN.email)
        .maybeSingle();

    if (error) {
        throw new Error(`Could not look up the seeded admin: ${error.message}`);
    }

    if (profile) {
        const { error: updateError } = await db.auth.admin.updateUserById(profile.user_id, {
            password: SEEDED_ADMIN.password,
            email_confirm: true,
        });

        // A profile row with no matching auth user is exactly the half-migrated
        // state this function exists to repair, so say so rather than pressing
        // on to a sign-in that cannot work.
        if (updateError) {
            throw new Error(
                `"${SEEDED_ADMIN.email}" has a profile row but no usable auth account ` +
                    `(${updateError.message}).\n\nDelete the row and re-run, or apply the ` +
                    'migrations to this project: npx supabase db push',
            );
        }

        if (profile.role !== 'admin') {
            await db.from('users').update({ role: 'admin' }).eq('user_id', profile.user_id);
        }

        return;
    }

    const { data: created, error: createError } = await db.auth.admin.createUser({
        email: SEEDED_ADMIN.email,
        password: SEEDED_ADMIN.password,
        email_confirm: true,
        user_metadata: { first_name: 'Admin', last_name: 'Test' },
    });

    if (createError || !created.user) {
        throw new Error(`Could not create the seeded admin: ${createError?.message}`);
    }

    const { error: roleError } = await db
        .from('users')
        .update({ role: 'admin' })
        .eq('user_id', created.user.id);

    if (roleError) {
        throw new Error(
            `Created "${SEEDED_ADMIN.email}" but could not make it an admin: ${roleError.message}`,
        );
    }
}

export default async function globalSetup(): Promise<void> {
    // Throws with instructions when a value is missing, and refuses outright
    // when the url matches .env.local.
    const env = e2eEnv();

    const db = testDb();

    const { data: category, error } = await db
        .from('skill_categories')
        .select('category_id, name')
        .eq('category_id', GENERAL_KNOWLEDGE_CATEGORY_ID)
        .maybeSingle();

    if (error) {
        throw new Error(
            `Could not reach the E2E Supabase project at ${env.supabaseUrl}:\n  ${error.message}\n\n` +
                'Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.e2e.',
        );
    }

    // Before the seed check, because an unseeded project and a differently
    // shaped one produce the same symptom and completely different fixes. The
    // two databases were built by hand at different times (ARCHITECTURE §0) and
    // drifted; `topic_title` is the column that drifted, and without it every
    // baseline produces an empty plan — the exact failure this journey exists
    // to detect, arriving for the wrong reason.
    const { error: shapeError } = await db
        .from('questions')
        .select('question_id, topic_title, study_advice')
        .limit(1);

    if (shapeError) {
        throw new Error(
            `The E2E project's schema is behind the repository:\n  ${shapeError.message}\n\n` +
                'Apply the migrations, then seed:\n' +
                '  npx supabase db push\n' +
                '  npm run seed:e2e',
        );
    }

    if (!category) {
        throw new Error(
            `The E2E project has no category ${GENERAL_KNOWLEDGE_CATEGORY_ID} — the baseline's ` +
                'sentinel row.\n\nSeed it:  npm run seed:e2e\n\n' +
                'If the seed refuses with "cannot insert a non-DEFAULT value into column ' +
                '\\"category_id\\"", run e2e/schema-patch.sql first.',
        );
    }

    const key = await readBaselineAnswerKey(db);

    if (key.size < BASELINE_QUESTION_COUNT) {
        throw new Error(
            `The E2E project has ${key.size} active baseline questions; the paper needs ` +
                `${BASELINE_QUESTION_COUNT}.\nstartBaseline() would refuse to open a run.\n\n` +
                'Seed it:  npm run seed:e2e',
        );
    }

    // After the seed checks, because a project that cannot serve a paper is a
    // more fundamental problem than one whose admin needs provisioning — and
    // reporting the shallower one first would send someone to the wrong fix.
    await ensureSeededAdmin(db);

    console.log(
        `[e2e] ${env.supabaseUrl} — "${category.name}", ${key.size} active baseline questions, ` +
            `admin "${SEEDED_ADMIN.email}" ready.`,
    );
}
