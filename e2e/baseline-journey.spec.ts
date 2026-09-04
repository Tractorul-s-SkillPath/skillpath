/**
 * One member, one continuous path: register -> baseline -> results -> plan.
 *
 * Story: SP-101
 *
 * THE THREE THINGS THIS EXISTS TO CATCH, none of which any other test in the
 * repository can see:
 *
 * 1. **A broken `grade_assessment()`.** It is SQL — `SECURITY DEFINER`, in the
 *    database, holding the answer key the application is never allowed to read.
 *    tests/lib/services/grading.service.test.ts asserts that `submit()` calls
 *    the RPC; nothing anywhere asserts the RPC is *right*. So this answers a
 *    known mix and pins the exact score, plus the per-band breakdown, which is
 *    the `is_correct` snapshots (D4) read back through a second code path.
 *    "A score appeared" would pass against a function that returns a constant.
 *
 * 2. **A broken session cookie.** The path crosses `assertAuth()` eight times.
 *    The last step then FORGES the cookie and expects to be bounced: middleware
 *    checks only that the cookie is present, so without that step a build where
 *    the HMAC is never verified passes this file end to end.
 *
 * 3. **A plan that silently stops being written.** grading.service catches a
 *    failed plan write and logs it, deliberately — the run is graded and paid
 *    by then, and a plan failure must not turn a success into an error. The
 *    consequence is that this failure mode is INVISIBLE to every caller: HTTP
 *    200, correct score, no plan. Only rendered rows can catch it, which is why
 *    the journey ends on /plan and not on the results page.
 *
 * A fresh member every run, and not for tidiness: the baseline is one attempt
 * per member (`startBaseline` returns the results once a submitted run exists),
 * so a fixture account could take this journey exactly once, ever.
 */

import { test, expect, type Locator, type Page } from '@playwright/test';
import { BASELINE_QUESTION_COUNT, LEVEL_LABELS } from '../lib/domain/constants';
import { estimateLevel } from '../lib/domain/levels';
import { formatScore } from '../lib/utils';
import {
    assessmentsFor,
    deleteMember,
    findUserByEmail,
    planFor,
    readBaselineAnswerKey,
    storedAnswers,
    testDb,
} from './helpers/db';
import { newMember, register, sessionCookies, signIn, type Member } from './helpers/member';

/**
 * 12 of 20. Chosen so that the expected score sits well inside a band rather
 * than on one of its edges — the boundaries are levels.test.ts's job, and a
 * journey that fails because 50 moved would be reporting the wrong thing — and
 * so that eight misses produce a plan with something in it. A perfect paper is
 * a green run that proves nothing about §3 above.
 */
const CORRECT_ANSWERS = 12;

const EXPECTED_SCORE = (CORRECT_ANSWERS / BASELINE_QUESTION_COUNT) * 100;
const EXPECTED_LEVEL = LEVEL_LABELS[estimateLevel(EXPECTED_SCORE)];

/**
 * Eight misses, eight plan items — every baseline question in the seed carries
 * both a topic_title and a study_advice, which is what
 * buildBaselineRecommendations needs to turn a miss into a plan row.
 *
 * A NUMBER, and deliberately not `expectedTopics.length`. That list is what the
 * plan assertions further down compare against, so it cannot also be the thing
 * that says how long it should be: if the E2E bank lost topic_title on seven of
 * these eight, the list would quietly shrink to one, the plan would shrink to
 * match it, and every assertion below would stay green over a plan feature that
 * had all but stopped working. Pinning the count is what makes those
 * comparisons mean something.
 */
const EXPECTED_PLAN_ITEMS = BASELINE_QUESTION_COUNT - CORRECT_ANSWERS;

const db = testDb();

/** Both set once the account exists, so teardown knows what to remove. */
let member: Member | null = null;
let memberId: string | null = null;

/**
 * Rows are KEPT by default. The run is meant to be inspectable afterwards — a
 * graded baseline writes across six tables, and reading those rows in the table
 * editor is how you check the two the assertions do not cover: category_progress
 * and xp_events, both written by triggers rather than by application code.
 *
 * Nothing depends on a clean database. Every run invents its own identity, so
 * leftovers cost storage and nothing else. `E2E_CLEAN=1` removes them, which is
 * what CI passes so a shared project does not gain a member per push.
 */
test.afterAll(async () => {
    if (member === null || memberId === null) return;

    if (process.env.E2E_CLEAN !== '1') {
        console.log(
            `[e2e] kept ${member.email} (user_id ${memberId}) — inspect it in the table editor. ` +
                'E2E_CLEAN=1 removes it instead.',
        );
        return;
    }

    try {
        await deleteMember(db, memberId);
    } catch (error) {
        // Never fail a green run on housekeeping.
        console.warn(`[e2e] could not clean up ${member.email}:`, error);
    }
});

/** The question text a card is asking, from the second span of its legend. */
async function questionTextOf(card: Locator): Promise<string> {
    return (await card.locator('legend span').nth(1).innerText()).trim();
}

/**
 * "6 of 7 correct" x3, summed. The is_correct snapshots, read back.
 *
 * Each band is found BY ITS LABEL, not swept off the page with `dl dd`. The
 * score card owns the only <dl> on the results page today, and the sweep worked
 * because of it — but it was a page-wide selector standing in for a
 * card-shaped fact, and a second <dl> added anywhere on this route would have
 * inflated both halves of the sum in step while every assertion kept passing.
 *
 * A row that goes missing or stops reading "N of M correct" now fails here,
 * naming the band, rather than silently contributing nothing to the total.
 */
async function bandTotals(page: Page): Promise<{ correct: number; total: number }> {
    const totals = { correct: 0, total: 0 };

    for (const label of Object.values(LEVEL_LABELS)) {
        const row = page.locator('dl > div').filter({ hasText: label });

        await expect(row, `the score card has no "${label}" band row`).toHaveCount(1);

        // <dd> is role="definition" — one per band row.
        const text = (await row.getByRole('definition').innerText()).trim();
        const match = text.match(/(\d+)\s+of\s+(\d+)/);

        expect(
            match,
            `the "${label}" band does not read "N of M correct": "${text}"`,
        ).not.toBeNull();

        totals.correct += Number(match![1]);
        totals.total += Number(match![2]);
    }

    return totals;
}

test('a new member registers, sits the baseline, and gets a plan', async ({ page, context }) => {
    const who = (member = newMember());

    // Printed up front, not just on the way out: it is what you filter the
    // Supabase table editor by while the run is still going, and it is the only
    // way to find these rows again — every run invents a new identity.
    console.log(
        `[e2e] ${who.email}` +
            (process.env.E2E_CLEAN === '1'
                ? ' — E2E_CLEAN=1, rows will be removed afterwards.'
                : ' — rows are left in place afterwards.'),
    );

    const answerKey = await readBaselineAnswerKey(db);

    /** Topics deliberately missed — what the plan must end up containing. */
    const expectedTopics: string[] = [];

    /** questionId -> the answer id this test clicked, to check against the rows. */
    const intended = new Map<number, number>();

    let assessmentId = 0;

    await test.step('register', async () => {
        await register(page, who);

        // Registering does NOT sign you in — loginAction's create branch ends in
        // redirect('/success') and never calls createSession. Pinned here
        // because it is surprising, and because if it ever changes the login
        // step below would start passing for the wrong reason.
        const cookies = await context.cookies();
        expect(cookies.find((c) => c.name === 'skillpath_session')).toBeUndefined();
    });

    await test.step('the account exists in the E2E project, not the demo one', async () => {
        // The real environment check. Everything in e2e/helpers/env.ts proves
        // the HARNESS is aimed at the test project; this proves the SERVER is.
        // Pointed anywhere else, the row the browser just created is not here.
        const user = await findUserByEmail(db, who.email);

        expect(
            user,
            `${who.email} was registered through the browser but is not in the E2E database. ` +
                'The app under test is reading a different Supabase project than .env.e2e names.',
        ).not.toBeNull();

        expect(user!.role).toBe('student');
        expect(user!.status).toBe('active');

        memberId = user!.user_id;
    });

    await test.step('sign in', async () => {
        await signIn(page, who, /\/dashboard$/);

        // The cookie is Supabase's now, not `skillpath_session` — that scheme
        // and lib/auth/session.ts are gone. See sessionCookies() for why this
        // is a helper rather than an inline name match.
        const session = sessionCookies(await context.cookies());

        expect(session.length, 'signing in did not set a Supabase session cookie').toBeGreaterThan(
            0,
        );

        for (const cookie of session) {
            // KEPT FROM THE OLD SCHEME ON PURPOSE. @supabase/ssr defaults this
            // to FALSE, because the usual setup has a browser client that reads
            // the token with JavaScript. This app has none, so
            // lib/supabase/server.ts overrides it — and without this assertion
            // that override can be dropped, or the library's default can
            // change, and the session becomes XSS-readable with nothing going
            // red.
            expect(cookie.httpOnly, `${cookie.name} is readable from JavaScript`).toBe(true);
            expect(cookie.value.length, `${cookie.name} is empty`).toBeGreaterThan(0);
        }
    });

    await test.step('open the baseline', async () => {
        // Straight to the front door rather than through the dashboard card,
        // which links with target="_blank" — the popup is the link's behaviour,
        // not the journey's, and it belongs in its own test. /assessments/
        // baseline is the same URL that card points at.
        await page.goto('/assessments/baseline');

        await expect(page).toHaveURL(/\/assessments\/\d+$/);
        assessmentId = Number(page.url().split('/').pop());

        await expect(page.getByRole('heading', { name: /baseline/i })).toBeVisible();
    });

    await test.step(`answer ${CORRECT_ANSWERS} of ${BASELINE_QUESTION_COUNT} correctly`, async () => {
        const cards = page.locator('fieldset[id^="q-"]');
        await expect(cards).toHaveCount(BASELINE_QUESTION_COUNT);

        for (let index = 0; index < BASELINE_QUESTION_COUNT; index += 1) {
            const card = cards.nth(index);
            const questionText = await questionTextOf(card);
            const entry = answerKey.get(questionText);

            expect(
                entry,
                `the paper asked a question that is not in the bank: "${questionText}"`,
            ).toBeDefined();

            const answerCorrectly = index < CORRECT_ANSWERS;
            const option = answerCorrectly ? entry!.correct : entry!.wrong[0];

            await card.getByRole('radio', { name: option.text, exact: true }).check();
            intended.set(entry!.questionId, option.answerId);

            // buildBaselineRecommendations skips a missed question with no
            // topic or no advice, so the expectation tracks the same rule
            // rather than assuming every question carries one.
            if (!answerCorrectly && entry!.topicTitle && entry!.studyAdvice) {
                expectedTopics.push(entry!.topicTitle);
            }
        }

        // Doubles as the hydration check, so it says so: the count is React
        // state and every radio above was clicked, so a count that never moves
        // means the client bundle did not load and no answer was ever saved.
        await expect(
            page.getByText(`${BASELINE_QUESTION_COUNT} of ${BASELINE_QUESTION_COUNT} answered`),
            'the answered counter did not reach the full paper — if it is still 0, the runner ' +
                'never hydrated and the radios are checked natively rather than saved. Check the ' +
                'dev server log for "Blocked cross-origin request to Next.js dev resource".',
        ).toBeVisible();

        // The runner saves optimistically: the counter above is React state,
        // not the database. Submitting while the last saveAnswerAction is still
        // in flight would grade that question as unanswered and cost 5 points —
        // a flake that looks exactly like a grading bug. Wait for the rows.
        await expect
            .poll(
                async () =>
                    [...(await storedAnswers(db, assessmentId)).values()].filter(
                        (id) => id !== null,
                    ).length,
                { timeout: 30_000 },
            )
            .toBe(BASELINE_QUESTION_COUNT);

        // And then check WHICH answer landed, not just that one did. Without
        // this, a saveAnswer that stored the wrong option is indistinguishable
        // from a grade_assessment that scores wrong: both surface as a wrong
        // percentage two steps later, and the SQL function takes the blame.
        // With it, a failing score can only mean grading.
        expect(
            Object.fromEntries(await storedAnswers(db, assessmentId)),
            'the answers stored server-side are not the ones the browser picked — this is ' +
                'saveAnswer, not grading',
        ).toEqual(Object.fromEntries(intended));
    });

    await test.step('submit and land on the results', async () => {
        // Nothing unanswered, so SubmitDialog commits on the first click
        // instead of asking to confirm.
        await page.getByRole('button', { name: 'Submit assessment' }).click();

        await expect(page).toHaveURL(new RegExp(`/assessments/${assessmentId}/results$`));
    });

    await test.step('the score is exactly right', async () => {
        await expect(page.getByText(formatScore(EXPECTED_SCORE), { exact: true })).toBeVisible();
        await expect(page.getByText('Starting level')).toBeVisible();
        await expect(page.getByText(EXPECTED_LEVEL).first()).toBeVisible();

        // The band breakdown comes from the per-response is_correct snapshots,
        // the score from assessments.total_score. Two writes of the same RPC —
        // if they disagree, grade_assessment() is scoring one way and
        // snapshotting another, which no unit test can see.
        const bands = await bandTotals(page);
        expect(bands).toEqual({ correct: CORRECT_ANSWERS, total: BASELINE_QUESTION_COUNT });
    });

    await test.step('the plan was written', async () => {
        expect(
            expectedTopics.length,
            'the misses did not all produce a topic. buildBaselineRecommendations skips a missed ' +
                'question with no topic_title or no study_advice, so the E2E bank is missing ' +
                'those columns on some of them — run e2e/schema-patch.sql, then npm run seed:e2e. ' +
                'Left alone, the plan assertions below would shrink to fit and pass.',
        ).toBe(EXPECTED_PLAN_ITEMS);

        await expect(page.getByText('What to focus on')).toBeVisible();

        for (const topic of expectedTopics) {
            await expect(page.getByText(topic, { exact: true }).first()).toBeVisible();
        }
    });

    await test.step('and it is on the plan page', async () => {
        await page.getByRole('link', { name: 'View your plan' }).click();

        await expect(page).toHaveURL(/\/plan$/);
        await expect(page.getByText(`0 of ${expectedTopics.length} done`)).toBeVisible();

        for (const topic of expectedTopics) {
            await expect(page.getByText(topic, { exact: true }).first()).toBeVisible();
        }
    });

    await test.step('the database agrees with the pages', async () => {
        const runs = await assessmentsFor(db, memberId!);
        expect(runs).toHaveLength(1);
        expect(runs[0].status).toBe('submitted');
        expect(runs[0].submitted_at).not.toBeNull();
        expect(Number(runs[0].total_score)).toBe(EXPECTED_SCORE);

        const plan = await planFor(db, memberId!);
        expect(plan.map((item) => item.topic_title).sort()).toEqual([...expectedTopics].sort());
        expect(plan.every((item) => item.progress_status === 'not_started')).toBe(true);
    });

    await test.step('a forged cookie is not a session', async () => {
        // ------------------------------------------------------------------
        // REWRITTEN FOR SUPABASE AUTH, ASSERTING THE SAME PROPERTY.
        //
        // This used to flip a character in the HMAC of our own
        // `skillpath_session` cookie. That cookie no longer exists: the session
        // is Supabase's, held in `sb-<project-ref>-auth-token`, and it is a JWT
        // signed with a key the browser has never seen.
        //
        // The property under test is unchanged and is still worth a step — a
        // tampered session must not be a session. What makes it worth keeping
        // is that it is the only check on the ONE thing this migration could
        // have got quietly wrong: middleware calls `getUser()`, which verifies
        // the token against the auth server, and not `getSession()`, which
        // decodes whatever the request carried and believes it. Both compile,
        // both work when the cookie is honest, and only one of them fails here.
        //
        // EVERY session cookie is corrupted, not the first one found. The
        // earlier version took a single match on `name.includes('auth-token')`,
        // which also matches the PKCE cookie `…auth-token-code-verifier` — so
        // on a run where that one came back first, the real session survived
        // untouched, /plan answered 200 and this step failed. It passed under
        // `npm run test:e2e` and failed under `test:e2e:dev` on the same
        // commit. sessionCookies() carries the rest of that note.
        // ------------------------------------------------------------------
        const session = sessionCookies(await context.cookies());

        expect(
            session.length,
            'no Supabase session cookie on the context — the sign-in step did not leave one, ' +
                'so this step would pass without proving anything',
        ).toBeGreaterThan(0);

        // A character in the middle of each, so the change lands in the payload
        // rather than in base64 padding that may decode to the same bytes. Two
        // candidate replacements because the original might already be the one
        // we would substitute.
        const forged = session.map((cookie) => {
            const at = Math.floor(cookie.value.length / 2);
            const value =
                cookie.value.slice(0, at) +
                (cookie.value[at] === 'A' ? 'B' : 'A') +
                cookie.value.slice(at + 1);

            expect(value, `the forgery did not change ${cookie.name}`).not.toBe(cookie.value);

            return { ...cookie, value };
        });

        await context.addCookies(forged);
        await page.goto('/plan');

        await expect(page).toHaveURL(/\/login/);
    });
});
