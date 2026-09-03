/**
 * The cross-role seam: an admin writes a question, a student sits it, and the
 * answer key does not travel.
 *
 * Story: SP-101 · owner B
 *
 * WHAT THIS CATCHES THAT THE UNIT SUITE CANNOT
 *
 * `answers.is_correct` is the answer key, and with RLS off the ONLY thing
 * keeping it away from a student is `assertAdmin()` at the top of
 * question.service and a hand-written column list in response.repo
 * (ARCHITECTURE §5). Both halves are already unit-tested in isolation —
 * response.repo.test.ts pins the column list, assessment-runner.test.tsx pins
 * the rendered props. Neither can see the seam itself, because neither runs
 * both roles against one database:
 *
 * 1. **A question that an admin can write but no student can be served.**
 *    `insertWithAnswers` sets `category_id`, `text`, `difficulty`, `source` and
 *    `created_by` — and NOT `status`, so a manually written question is active
 *    only because the column defaults that way. `listActiveIds` filters on
 *    exactly that column. Every unit test in the repository fakes one side of
 *    that pair. Here the admin's row has to survive the student's query.
 *
 * 2. **The key crossing the wire in a spelling nobody greps for.** The
 *    repository boundary renames `is_correct` to `isCorrect` (mappers.ts:158),
 *    so a leak through the normal code path arrives camelCased, and the results
 *    page has a third name for it again — `correctAnswerId`. A check for the
 *    database spelling alone passes a build that ships all three.
 *
 * THE POSITIVE HALF IS THE POINT. "The payload does not contain the key" is
 * true of an error page, a login redirect, and an empty string. So every
 * negative here is paired with a positive on the same bytes: the admin's own
 * screen must SHOW the key, and the student's payload must contain the question
 * and all four of its options. Only then does their absence mean anything.
 *
 * WHY A CATEGORY OF ITS OWN, AND WHY FIVE QUESTIONS
 *
 * A category run draws `CATEGORY_PAPER_SIZE` questions from the bank at random
 * (`drawPaper`). Adding one question to a seeded category of ten would put it
 * on the paper ten times out of eleven — a test that fails once a fortnight for
 * no reason. `drawPaper` returns the WHOLE bank when the bank is smaller than
 * the paper, so a category the run invents, filled to exactly
 * MIN_CATEGORY_QUESTIONS, is served in full and in full every time.
 *
 * The baseline cannot host this at all: it takes the first twenty question ids
 * in ascending order, and a question written today has the highest id in the
 * table.
 */

import { test, expect, type Page } from '@playwright/test';
import { CATEGORY_PAPER_SIZE, MIN_CATEGORY_QUESTIONS } from '../lib/domain/constants';
import { ANSWERS_MIN } from '../lib/validation/question.schema';
import {
    deleteCategory,
    deleteMember,
    findCategoryByName,
    findUserByEmail,
    questionsInCategory,
    testDb,
} from './helpers/db';
import { newMember, register, signIn, SEEDED_ADMIN, type Member } from './helpers/member';

/**
 * Every name the answer key goes by on its way out of the database. The first
 * is the column, the second is what mappers.ts renames it to, the third is what
 * the results page derives from it. A leak wears whichever one is nearest.
 */
const KEY_SPELLINGS = ['is_correct', 'isCorrect', 'correctAnswerId'] as const;

interface DraftQuestion {
    text: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    options: string[];
    /** Index into `options`. Never 0 for the question under test — see below. */
    correctIndex: number;
}

const db = testDb();

/** Set as they come into existence, so teardown knows what to unwind. */
let student: Member | null = null;
let studentId: string | null = null;
let categoryId: number | null = null;

/** Flipped by the last line of the test. Teardown reads it — see below. */
let passed = false;

/**
 * Everything goes, or nothing does.
 *
 * The two halves cannot be separated even if we wanted to: the student's
 * assessment points at the category, so keeping the member the way
 * baseline-journey.spec.ts does would pin the category down with it.
 *
 * And unlike that spec, the default here is to REMOVE. A kept member is a row
 * nobody sees; a kept category is active, has a full bank, and appears on the
 * /assessments page of every student in the project — one more per run. What is
 * kept instead is a FAILED run, because deleting the rows a failure happened on
 * is deleting the evidence. `E2E_CLEAN=1` removes those too, which is what CI
 * passes: a red pipeline there has the trace and the video already.
 */
test.afterAll(async () => {
    const forced = process.env.E2E_CLEAN === '1';

    if (!passed && !forced) {
        // Only what actually got created — a failure early in the admin half
        // leaves no student, and naming one that does not exist sends whoever
        // reads this looking for a row that was never written.
        const kept = [
            categoryId === null ? null : `category ${categoryId}`,
            studentId === null ? null : `student ${student?.email} (user_id ${studentId})`,
        ].filter((entry) => entry !== null);

        if (kept.length > 0) {
            console.log(
                `[e2e] the run failed — keeping ${kept.join(' and ')} to look at. ` +
                    'E2E_CLEAN=1 removes them anyway.',
            );
        }

        return;
    }

    // The member first: student_responses reference the questions, and the
    // questions will not delete while they do.
    if (studentId !== null) {
        try {
            await deleteMember(db, studentId);
        } catch (error) {
            console.warn(`[e2e] could not clean up ${student?.email}:`, error);
        }
    }

    if (categoryId !== null) {
        try {
            await deleteCategory(db, categoryId);
        } catch (error) {
            console.warn(
                `[e2e] category ${categoryId} is still in the project and will show up on every ` +
                    'student\'s /assessments page — delete it by hand:',
                error,
            );
        }
    }
});

/**
 * Fill the new-question form once.
 *
 * `expectedBankSize` is the wait, not a courtesy assertion. The form clears
 * itself on success (question-form.tsx remounts AnswerRows with a new key), so
 * typing the next question into a form that has not reset yet would silently
 * append to the previous one. Waiting on the heading's count is the only signal
 * here that is monotonic — a stale "Question added." from the previous
 * submission looks exactly like a fresh one.
 */
async function addQuestion(
    page: Page,
    question: DraftQuestion,
    expectedBankSize: number,
): Promise<void> {
    await page.fill('textarea[name="text"]', question.text);
    await page.selectOption('select[name="difficulty"]', question.difficulty);

    // The form opens with ANSWERS_MIN rows and grows by a button, so anything
    // wider than two options has to be clicked into existence first.
    for (let index = ANSWERS_MIN; index < question.options.length; index += 1) {
        await page.getByRole('button', { name: 'Add another option' }).click();
    }

    for (const [index, text] of question.options.entries()) {
        await page.fill(`input[name="option_text_${index}"]`, text);
    }

    await page.check(`input[name="option_correct_${question.correctIndex}"]`);
    await page.getByRole('button', { name: 'Add question' }).click();

    const noun = expectedBankSize === 1 ? 'question' : 'questions';
    await expect(
        page.getByText(`${expectedBankSize} ${noun} in this category.`),
        `the bank did not grow to ${expectedBankSize} — "${question.text}" was not saved`,
    ).toBeVisible();

    // The reset landed, so the next call is typing into an empty form rather
    // than onto the end of this one.
    await expect(page.locator('textarea[name="text"]')).toHaveValue('');
}

test('an admin writes a question, a student is served it, and the key stays behind', async ({
    browser,
    baseURL,
}) => {
    // The whole-bank guarantee this spec is built on. If the minimum ever grows
    // past the paper size, the run below becomes a random draw again and the
    // "served exactly these" assertion turns flaky — say so here rather than
    // one flake per fortnight later.
    expect(
        MIN_CATEGORY_QUESTIONS,
        'a bank at the minimum is no longer served whole; this spec needs to pick its own paper size',
    ).toBeLessThanOrEqual(CATEGORY_PAPER_SIZE);

    const runId = Math.random().toString(36).slice(2, 8);
    const categoryName = `E2E Bank ${runId}`;

    /**
     * The question the assertions are about. Four options, and the correct one
     * is at index 2 ON PURPOSE: the options reach the database positioned by
     * their index in the form, so a build that marks the first option correct
     * regardless of the checkbox would pass with the key at 0 and only fails
     * because it is not.
     */
    const subject: DraftQuestion = {
        text: `Which marker does E2E run ${runId} use?`,
        difficulty: 'intermediate',
        options: [
            `Marker ${runId} alpha`,
            `Marker ${runId} beta`,
            `Marker ${runId} gamma`,
            `Marker ${runId} delta`,
        ],
        correctIndex: 2,
    };

    const correctOption = subject.options[subject.correctIndex];
    const wrongOptions = subject.options.filter((option) => option !== correctOption);

    /** Padding to MIN_CATEGORY_QUESTIONS: startCategory refuses a shorter bank. */
    const filler: DraftQuestion[] = Array.from(
        { length: MIN_CATEGORY_QUESTIONS - 1 },
        (_, index) => ({
            text: `Filler ${runId} #${index + 1}`,
            difficulty: 'beginner',
            options: [`Filler ${runId} #${index + 1} right`, `Filler ${runId} #${index + 1} wrong`],
            correctIndex: 0,
        }),
    );

    const paper = [subject, ...filler];

    // Two contexts, not two sign-ins in one. The admin's session must not be
    // anywhere near the student's requests: this spec's whole claim is about
    // what the two roles are served, and sharing a cookie jar is the one way to
    // get a green run that proves the opposite of what it says.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();

    await test.step('the admin signs in and lands on the admin home', async () => {
        // /admin, not /dashboard — the redirect reads `role` from the database
        // row (current-user.ts:238). A seeded project is a precondition: the
        // register form refuses to make an admin.
        await signIn(adminPage, SEEDED_ADMIN, /\/admin$/);
    });

    await test.step('the admin creates a category', async () => {
        await adminPage.goto('/admin/categories');

        await adminPage.fill('input[name="name"]', categoryName);
        await adminPage.fill(
            'textarea[name="description"]',
            'Written by the E2E run. Safe to delete.',
        );
        await adminPage.getByRole('button', { name: 'Add category' }).click();

        await expect(adminPage.getByText(`"${categoryName}" created.`)).toBeVisible();

        // The same check baseline-journey.spec.ts makes after registering, for
        // the same reason: this proves the SERVER wrote to the project .env.e2e
        // names, not merely that the harness is pointed at it.
        const category = await findCategoryByName(db, categoryName);

        expect(
            category,
            `"${categoryName}" was created through the browser but is not in the E2E database. ` +
                'The app under test is reading a different Supabase project than .env.e2e names.',
        ).not.toBeNull();

        categoryId = category!.category_id;
        expect(category!.status).toBe('active');
    });

    await test.step(`the admin fills the bank with ${MIN_CATEGORY_QUESTIONS} questions`, async () => {
        // Through the list, not straight to the id: the link is how an admin
        // actually gets there, and a category that renders without one is a
        // category nobody can add questions to.
        const row = adminPage.getByRole('listitem').filter({ hasText: categoryName });
        await row.getByRole('link', { name: 'Questions' }).click();

        await expect(adminPage).toHaveURL(new RegExp(`/admin/categories/${categoryId}$`));

        for (const [index, question] of paper.entries()) {
            await addQuestion(adminPage, question, index + 1);
        }
    });

    await test.step('the admin CAN see which option is correct', async () => {
        // The positive half of the seam. Without it, the student-side assertion
        // three steps down would pass just as happily against a build where the
        // key never reaches ANYBODY — including the one person entitled to it.
        //
        // Two nested lists: the bank is a <ul> of questions and each question
        // carries a <ul> of its options, so an option's text matches its own
        // <li> AND the question <li> wrapped around it. Find the question first,
        // then look for options inside it — getByRole searches descendants, so
        // the outer one drops out on its own.
        const questionItem = adminPage.getByRole('listitem').filter({ hasText: subject.text });
        const optionItem = (text: string) =>
            questionItem.getByRole('listitem').filter({ hasText: text });

        await expect(
            optionItem(correctOption),
            'the admin question bank does not mark the correct option — assertAdmin is refusing ' +
                'the admin, or listQuestionsByCategory stopped selecting the key',
        ).toContainText('Correct:');

        for (const wrong of wrongOptions) {
            await expect(
                optionItem(wrong),
                `"${wrong}" is marked correct on the admin page and should not be`,
            ).not.toContainText('Correct:');
        }
    });

    await test.step('the questions are active, so a paper can draw them', async () => {
        const bank = await questionsInCategory(db, categoryId!);

        expect(bank).toHaveLength(MIN_CATEGORY_QUESTIONS);

        // insertWithAnswers never sets `status`; this is the column default
        // doing the work, and it is worth naming because the symptom of it
        // being wrong is "the student was not served the question" — a true
        // statement and the wrong diagnosis.
        expect(
            bank.map((question) => question.status),
            'an admin-created question came back inactive. insertWithAnswers does not set ' +
                '`status`, so questions.status must default to \'active\' — check the column in ' +
                'the E2E project.',
            ).toEqual(Array(MIN_CATEGORY_QUESTIONS).fill('active'));

        const written = bank.find((question) => question.text === subject.text);
        expect(written, 'the question under test is not in the bank').toBeDefined();

        // The checkbox the form ticked is the row the database holds, at the
        // position the form put it.
        expect(written!.answers.map((answer) => answer.text)).toEqual(subject.options);
        expect(written!.answers.filter((answer) => answer.isCorrect).map((a) => a.text)).toEqual([
            correctOption,
        ]);
    });

    await test.step('a student registers and signs in', async () => {
        const who = (student = newMember('Student'));

        await register(studentPage, who);
        await signIn(studentPage, who, /\/dashboard$/);

        const user = await findUserByEmail(db, who.email);
        expect(user, `${who.email} registered through the browser but is not in the E2E database`)
            .not.toBeNull();

        studentId = user!.user_id;
        expect(user!.role).toBe('student');
    });

    /**
     * Everything the student's browser is sent from here on, minus the bundles.
     *
     * Attached now and not earlier: the admin's pages are SUPPOSED to carry the
     * key, and a listener that had been running since sign-in would fail this
     * test on the one screen that is allowed to leak.
     *
     * `/_next/static/` is excluded and that exclusion is the point rather than
     * a shortcut — a chunk is application code, identical for everybody, and
     * `answer-rows.tsx` legitimately contains the string `isCorrect` because it
     * is the admin form's own source. What must not carry the key is the DATA:
     * the document and the RSC payload for this member's run.
     */
    const bodies: Array<Promise<string>> = [];

    studentPage.on('response', (response) => {
        const url = response.url();
        if (!url.startsWith(baseURL!) || url.includes('/_next/static/')) return;

        // Redirects carry no body worth reading, and this run makes one:
        // /assessments/start/:id bounces to /assessments/:id. That matters more
        // than it sounds. Chromium drops the body of a response the page has
        // navigated away from, and response.text() for a body that is already
        // gone can sit unsettled rather than rejecting — so collecting it hangs
        // the Promise.all below until the test budget runs out, which is what
        // CI saw twice while a local run finished in ten seconds.
        if (response.status() >= 300 && response.status() < 400) return;

        // The promise is collected rather than awaited in the handler:
        // Playwright does not wait for event handlers, so a handler that awaits
        // is a handler whose result may land after the assertion has read it.
        //
        // Bounded for the same reason the redirect is skipped: one body that
        // never arrives should cost seconds, not the whole test. Resolving a
        // lost body to '' cannot quietly weaken the negatives below — the
        // positive control asserts the captured payload still contains the
        // question and every option, so a body that genuinely went missing
        // fails there, loudly, instead of passing vacuously here.
        bodies.push(
            Promise.race([
                response.text().catch(() => ''),
                new Promise<string>((resolve) => {
                    setTimeout(() => resolve(''), 10_000);
                }),
            ]),
        );
    });

    await test.step('the student is served the paper the admin wrote', async () => {
        await studentPage.goto(`/assessments/start/${categoryId}`);

        // A refused start redirects to /assessments, which is also where an
        // under-filled bank lands — so the URL is the assertion.
        await expect(
            studentPage,
            'the run did not open. /assessments/start redirects there when startCategory refuses: ' +
                'the category is inactive, or its bank is under MIN_CATEGORY_QUESTIONS.',
        ).toHaveURL(/\/assessments\/\d+$/);

        const cards = studentPage.locator('fieldset[id^="q-"]');
        await expect(cards).toHaveCount(MIN_CATEGORY_QUESTIONS);

        // Every question the admin wrote, because a bank at or under the paper
        // size is drawn whole. Not "at least one appeared".
        for (const question of paper) {
            await expect(
                studentPage.locator('fieldset[id^="q-"]').filter({ hasText: question.text }),
                `"${question.text}" was written by the admin but not served to the student`,
            ).toHaveCount(1);
        }

        // And the question under test came with all four options, the correct
        // one among them and looking like the rest.
        const card = studentPage.locator('fieldset[id^="q-"]').filter({ hasText: subject.text });

        for (const option of subject.options) {
            await expect(card.getByRole('radio', { name: option, exact: true })).toBeVisible();
        }
    });

    await test.step('and the answer key did not come with it', async () => {
        const payload = (await Promise.all(bodies)).join('\n');
        const html = await studentPage.content();

        // The positive control, and the reason the three negatives below are
        // worth anything. `not.toContain` is true of an empty string, an error
        // page and a login redirect; this pins that what was captured is the
        // payload that CARRIES the options — the one a leak would ride out on.
        expect(
            payload,
            'nothing usable was captured from the student session, so the checks below would ' +
                'pass against a blank page',
        ).toContain(subject.text);

        for (const option of subject.options) {
            expect(payload, `option "${option}" never appeared in the captured payload`).toContain(
                option,
            );
        }

        for (const spelling of KEY_SPELLINGS) {
            expect(
                payload,
                `"${spelling}" reached the student over the wire — the answer key is in the ` +
                    'document or the RSC payload for their run',
            ).not.toContain(spelling);

            expect(
                html,
                `"${spelling}" is in the student's rendered page`,
            ).not.toContain(spelling);
        }
    });

    await adminContext.close();
    await studentContext.close();

    passed = true;
});
