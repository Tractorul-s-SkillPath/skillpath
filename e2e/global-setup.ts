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
import { readBaselineAnswerKey, testDb } from './helpers/db';

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
            `The E2E project's schema does not match the demo project's:\n  ${shapeError.message}\n\n` +
                'Run e2e/schema-patch.sql in the E2E project\'s SQL editor, then seed it.',
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

    console.log(
        `[e2e] ${env.supabaseUrl} — "${category.name}", ${key.size} active baseline questions.`,
    );
}
