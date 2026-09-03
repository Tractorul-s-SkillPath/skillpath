/**
 * Question actions, scoped to one category.
 *
 * Layer: ACTION. Stories: SP-033, SP-034, SP-035, SP-036
 *
 * Three things here are worth a test, and all three are bugs the source header
 * records as fixed:
 *
 *  1. Options are read as `isCorrect`, the name `NewQuestion` and
 *     `insertWithAnswers` use. An earlier version built them as `is_correct` —
 *     the database spelling — and got past the compiler with `as any`. The
 *     repository reads `answer.isCorrect`, so every option went in with an
 *     undefined answer key: questions saved, none of them answerable. Nothing
 *     but an assertion on the shape handed to the service can catch that.
 *
 *  2. Editing is a new question PLUS a retired old one, never an UPDATE —
 *     `student_responses.is_correct` is a snapshot of what a member was told at
 *     the time (D4). And the new row is written FIRST: retiring before creating
 *     left the category with neither when the create failed.
 *
 *  3. When the retire half fails, both versions are live. The action says so
 *     rather than reporting a clean success, because the admin has to
 *     deactivate one by hand.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createQuestionAction,
    editQuestionAction,
    setQuestionStatusAction,
} from '../../../../../../app/(admin)/admin/categories/[id]/actions';
import * as questionService from '../../../../../../lib/services/question.service';
import { revalidatePath } from 'next/cache';
import { ok, err } from '../../../../../../lib/result';
import { appError } from '../../../../../../lib/errors';
import { IDLE } from '../../../../../../lib/validation/common';

vi.mock('../../../../../../lib/services/question.service');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
    redirect: vi.fn((url: string) => {
        throw Object.assign(new Error('NEXT_REDIRECT'), { url });
    }),
}));

const CATEGORY = 3;

/** A valid question form: two options, the first correct. */
function questionForm(
    overrides: { text?: string; difficulty?: string; options?: Array<[string, boolean]> } = {},
): FormData {
    const data = new FormData();
    data.set('text', overrides.text ?? 'What does an index change?');
    data.set('difficulty', overrides.difficulty ?? 'beginner');

    const options = overrides.options ?? ([['The query plan', true], ['The row order', false]] as Array<[string, boolean]>);

    options.forEach(([text, correct], index) => {
        data.set(`option_text_${index}`, text);
        // HTML omits an unchecked checkbox entirely, so an incorrect option
        // sends no `option_correct_i` at all rather than "false".
        if (correct) data.set(`option_correct_${index}`, 'true');
    });

    return data;
}

async function redirectOf(run: () => Promise<unknown>): Promise<string> {
    try {
        await run();
    } catch (error) {
        if (error instanceof Error && 'url' in error) return (error as { url: string }).url;
        throw error;
    }
    throw new Error('expected a redirect');
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(questionService.createQuestion).mockResolvedValue(ok(42));
    vi.mocked(questionService.setQuestionStatus).mockResolvedValue(ok(undefined));
});

describe('createQuestionAction', () => {
    it('hands the service options keyed isCorrect, not is_correct', async () => {
        // Bug 1, asserted on the exact shape. `toHaveBeenCalledWith` on an
        // object with the wrong key name fails; a looser assertion would not.
        await createQuestionAction(CATEGORY, IDLE, questionForm());

        expect(questionService.createQuestion).toHaveBeenCalledWith({
            categoryId: CATEGORY,
            text: 'What does an index change?',
            difficulty: 'beginner',
            answers: [
                { text: 'The query plan', isCorrect: true },
                { text: 'The row order', isCorrect: false },
            ],
        });
    });

    it('takes the category from the argument, not the form', async () => {
        const form = questionForm();
        form.set('categoryId', '999');

        await createQuestionAction(CATEGORY, IDLE, form);

        expect(questionService.createQuestion).toHaveBeenCalledWith(
            expect.objectContaining({ categoryId: CATEGORY }),
        );
    });

    it('drops the blank option rows the form always renders', async () => {
        // The editor renders a fixed number of inputs and an admin writing two
        // options leaves the rest alone. Sending them on would fail the
        // "an option cannot be empty" rule on every single save.
        const form = questionForm();
        form.set('option_text_2', '   ');
        form.set('option_text_3', '');

        await createQuestionAction(CATEGORY, IDLE, form);

        expect(questionService.createQuestion).toHaveBeenCalledWith(
            expect.objectContaining({ answers: expect.arrayContaining([]) }),
        );

        const call = vi.mocked(questionService.createQuestion).mock.calls[0][0];
        expect(call.answers).toHaveLength(2);
    });

    it('supports more than one correct option', async () => {
        // Multi-select. The schema's `>= 1` and the dropped unique index moved
        // together; this is the action half of that.
        await createQuestionAction(
            CATEGORY,
            IDLE,
            questionForm({ options: [['A', true], ['B', true], ['C', false]] }),
        );

        const call = vi.mocked(questionService.createQuestion).mock.calls[0][0];
        expect(call.answers.filter((a) => a.isCorrect)).toHaveLength(2);
    });

    it('rejects a question with no correct option, before the service', async () => {
        const result = await createQuestionAction(
            CATEGORY,
            IDLE,
            questionForm({ options: [['A', false], ['B', false]] }),
        );

        expect(result.status).toBe('error');
        expect(result.fields).toBeDefined();
        expect(questionService.createQuestion).not.toHaveBeenCalled();
    });

    it('rejects a single-option question', async () => {
        const result = await createQuestionAction(CATEGORY, IDLE, questionForm({ options: [['A', true]] }));

        expect(result.status).toBe('error');
        expect(questionService.createQuestion).not.toHaveBeenCalled();
    });

    it('revalidates the bank and reports success', async () => {
        const result = await createQuestionAction(CATEGORY, IDLE, questionForm());

        expect(result).toEqual({ status: 'success', message: 'Question added.' });
        expect(revalidatePath).toHaveBeenCalledWith(`/admin/categories/${CATEGORY}`);
    });

    it('returns the service failure without revalidating', async () => {
        vi.mocked(questionService.createQuestion).mockResolvedValue(
            err(appError('forbidden', "You don't have access to that.")),
        );

        const result = await createQuestionAction(CATEGORY, IDLE, questionForm());

        expect(result.status).toBe('error');
        expect(revalidatePath).not.toHaveBeenCalled();
    });
});

describe('editQuestionAction', () => {
    it('CREATES the replacement before retiring the original', async () => {
        // Bug 2, and the order is the whole assertion: retiring first meant a
        // failed create left the category with neither version.
        const order: string[] = [];

        vi.mocked(questionService.createQuestion).mockImplementation(async () => {
            order.push('create');
            return ok(43);
        });
        vi.mocked(questionService.setQuestionStatus).mockImplementation(async () => {
            order.push('retire');
            return ok(undefined);
        });

        await redirectOf(() => editQuestionAction(7, CATEGORY, IDLE, questionForm()));

        expect(order).toEqual(['create', 'retire']);
    });

    it('never UPDATES the original — the old row is retired, not rewritten', async () => {
        // D4: student_responses.is_correct is a snapshot of what a member was
        // told at the time. Rewriting in place restates their history.
        await redirectOf(() => editQuestionAction(7, CATEGORY, IDLE, questionForm()));

        expect(questionService.setQuestionStatus).toHaveBeenCalledWith(7, 'inactive');
        expect(questionService.createQuestion).toHaveBeenCalledOnce();
    });

    it('redirects back to the plain list', async () => {
        // Staying on ?edit=<id> would reopen the editor on a question that is
        // now inactive.
        const to = await redirectOf(() => editQuestionAction(7, CATEGORY, IDLE, questionForm()));

        expect(to).toBe(`/admin/categories/${CATEGORY}`);
    });

    it('does not retire anything when the replacement fails to save', async () => {
        vi.mocked(questionService.createQuestion).mockResolvedValue(
            err(appError('unknown', 'Something went wrong. Try again.')),
        );

        const result = await editQuestionAction(7, CATEGORY, IDLE, questionForm());

        expect(result.status).toBe('error');
        expect(questionService.setQuestionStatus).not.toHaveBeenCalled();
    });

    it('rejects an invalid edit without writing anything', async () => {
        const result = await editQuestionAction(7, CATEGORY, IDLE, questionForm({ text: 'no' }));

        expect(result.status).toBe('error');
        expect(questionService.createQuestion).not.toHaveBeenCalled();
        expect(questionService.setQuestionStatus).not.toHaveBeenCalled();
    });

    it('ADMITS that both versions are live when the retire half fails', async () => {
        // Bug 3. The edit did happen — reporting a clean success would leave a
        // duplicate in the bank that the admin never learns about, and a member
        // could be served either version.
        vi.mocked(questionService.setQuestionStatus).mockResolvedValue(
            err(appError('unknown', 'Something went wrong. Try again.')),
        );

        const result = await editQuestionAction(7, CATEGORY, IDLE, questionForm());

        expect(result.status).toBe('error');
        expect(result.message).toContain('both are in the bank');
        // It still revalidates: the new question IS there and the list must
        // show it, or the admin cannot deactivate the old one.
        expect(revalidatePath).toHaveBeenCalledWith(`/admin/categories/${CATEGORY}`);
    });
});

describe('setQuestionStatusAction', () => {
    const form = (fields: Record<string, string>) => {
        const data = new FormData();
        for (const [k, v] of Object.entries(fields)) data.set(k, v);
        return data;
    };

    it('retires a question and says answers already given are untouched', async () => {
        const result = await setQuestionStatusAction(
            IDLE,
            form({ questionId: '7', categoryId: String(CATEGORY), status: 'inactive' }),
        );

        expect(questionService.setQuestionStatus).toHaveBeenCalledWith(7, 'inactive');
        expect(result.message).toBe('Question deactivated — answers already given are untouched.');
    });

    it('activates', async () => {
        const result = await setQuestionStatusAction(
            IDLE,
            form({ questionId: '7', categoryId: String(CATEGORY), status: 'active' }),
        );

        expect(result).toEqual({ status: 'success', message: 'Question activated.' });
    });

    it('revalidates the category the question belongs to', async () => {
        await setQuestionStatusAction(
            IDLE,
            form({ questionId: '7', categoryId: '9', status: 'active' }),
        );

        expect(revalidatePath).toHaveBeenCalledWith('/admin/categories/9');
    });

    it('rejects a bad payload without calling the service', async () => {
        const result = await setQuestionStatusAction(
            IDLE,
            form({ questionId: 'abc', categoryId: '3', status: 'active' }),
        );

        expect(result.status).toBe('error');
        expect(questionService.setQuestionStatus).not.toHaveBeenCalled();
    });

    it('reports a failed change instead of silently repainting', async () => {
        vi.mocked(questionService.setQuestionStatus).mockResolvedValue(
            err(appError('not_found', 'That question no longer exists.')),
        );

        const result = await setQuestionStatusAction(
            IDLE,
            form({ questionId: '7', categoryId: '3', status: 'inactive' }),
        );

        expect(result.status).toBe('error');
        expect(revalidatePath).not.toHaveBeenCalled();
    });
});
