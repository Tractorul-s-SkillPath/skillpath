/**
 * Question actions, scoped to one category.
 *
 * Layer: ACTION — assertAdmin (in the service) -> zod -> service ->
 * revalidatePath (§3)
 * Stories: SP-033, SP-034, SP-035, SP-036, SP-092
 *
 * The options are read as `isCorrect`, which is the name `NewQuestion` and
 * `insertWithAnswers` use. An earlier version built them as `is_correct` — the
 * database spelling — and got past the compiler with `createQuestion(data as
 * any)`. The repository reads `answer.isCorrect`, so every option went in with
 * an undefined answer key: questions saved, and none of them were answerable.
 * That is the whole reason the cast is gone.
 *
 * Test: tests/app/(admin)/admin/categories/[id]/actions.test.ts
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import * as questionService from '../../../../../lib/services/question.service';
import {
    questionSchema,
    generateQuestionsSchema,
    ANSWERS_MAX,
} from '../../../../../lib/validation/question.schema';
import {
    fieldErrors,
    formError,
    formSuccess,
    type FormState,
} from '../../../../../lib/validation/common';

const questionStatusSchema = z.object({
    questionId: z.coerce.number().int().positive(),
    categoryId: z.coerce.number().int().positive(),
    status: z.enum(['active', 'inactive']),
});

/**
 * The option rows as the form posts them: `option_text_0..n` alongside
 * `option_correct_0..n`.
 *
 * A blank row is dropped rather than sent on as an empty option, because the
 * form renders a fixed number of inputs and an admin writing three options
 * leaves the fourth alone. The checkbox is unchecked-means-absent in HTML, so
 * `option_correct_i` is missing rather than "false" for an incorrect option —
 * comparing to 'true' handles both.
 */
function readAnswers(formData: FormData): Array<{ text: string; isCorrect: boolean }> {
    const answers: Array<{ text: string; isCorrect: boolean }> = [];

    for (let index = 0; index < ANSWERS_MAX; index++) {
        const text = formData.get(`option_text_${index}`);

        if (typeof text !== 'string' || text.trim() === '') continue;

        answers.push({
            text,
            isCorrect: formData.get(`option_correct_${index}`) === 'true',
        });
    }

    return answers;
}

export async function createQuestionAction(
    categoryId: number,
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const parsed = questionSchema.safeParse({
        categoryId,
        text: formData.get('text') ?? '',
        difficulty: formData.get('difficulty'),
        topicTitle: formData.get('topic_title') ?? '',
        studyAdvice: formData.get('study_advice') ?? '',
        answers: readAnswers(formData),
    });

    if (!parsed.success) return formError('Check the fields below.', fieldErrors(parsed.error));

    const result = await questionService.createQuestion(parsed.data);

    if (!result.ok) return formError(result.error.message, result.error.fields);

    revalidatePath(`/admin/categories/${categoryId}`);

    return formSuccess('Question added.');
}

/**
 * Editing is a new question plus a retired old one, not an UPDATE.
 *
 * `student_responses.is_correct` is a snapshot of what a member was told at the
 * time (D4). Rewriting a question in place would silently restate the history
 * of everybody who already answered it, so the old row stays exactly as it was
 * and stops being served.
 *
 * The new row is written FIRST. The previous version retired the old question
 * before creating its replacement, so a validation failure or a dropped
 * connection in between left the category with neither.
 */
export async function editQuestionAction(
    oldQuestionId: number,
    categoryId: number,
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const parsed = questionSchema.safeParse({
        categoryId,
        text: formData.get('text') ?? '',
        difficulty: formData.get('difficulty'),
        topicTitle: formData.get('topic_title') ?? '',
        studyAdvice: formData.get('study_advice') ?? '',
        answers: readAnswers(formData),
    });

    if (!parsed.success) return formError('Check the fields below.', fieldErrors(parsed.error));

    const created = await questionService.createQuestion(parsed.data);

    if (!created.ok) return formError(created.error.message, created.error.fields);

    const retired = await questionService.setQuestionStatus(oldQuestionId, 'inactive');

    if (!retired.ok) {
        // Both versions are live and both are answerable. Saying so is the only
        // honest option: the edit did happen, and the bank now has a duplicate
        // the admin has to deactivate by hand.
        revalidatePath(`/admin/categories/${categoryId}`);

        return formError(
            'The new version was saved, but the old one could not be deactivated — both are in the bank. Deactivate the old one below.',
        );
    }

    revalidatePath(`/admin/categories/${categoryId}`);

    // Back to the plain list: staying on ?edit=<id> would reopen the editor on
    // a question that is now inactive.
    redirect(`/admin/categories/${categoryId}`);
}

export async function setQuestionStatusAction(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const parsed = questionStatusSchema.safeParse({
        questionId: formData.get('questionId'),
        categoryId: formData.get('categoryId'),
        status: formData.get('status'),
    });

    if (!parsed.success) return formError('That change could not be applied.');

    const result = await questionService.setQuestionStatus(
        parsed.data.questionId,
        parsed.data.status,
    );

    if (!result.ok) return formError(result.error.message, result.error.fields);

    revalidatePath(`/admin/categories/${parsed.data.categoryId}`);

    return formSuccess(
        parsed.data.status === 'active'
            ? 'Question activated.'
            : 'Question deactivated — answers already given are untouched.',
    );
}

/**
 * Generate AI drafts for this category (SP-092).
 *
 * The drafts land in the bank below, inactive and labelled — there is no
 * separate review queue, because "an inactive question an admin has to
 * activate" IS the review queue and the screen already knows how to render it.
 * That also means edit / activate / delete work on a draft on day one, with no
 * second set of controls to keep in step with the first.
 *
 * Every failure below is a message, never a throw: AC4 is that malformed model
 * output reads as "generation failed, try again" and never as a 500.
 */
export async function generateQuestionsAction(
    categoryId: number,
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const parsed = generateQuestionsSchema.safeParse({
        categoryId,
        difficulty: formData.get('difficulty'),
        count: formData.get('count'),
    });

    if (!parsed.success) return formError('Check the fields below.', fieldErrors(parsed.error));

    const result = await questionService.generateDraftQuestions(parsed.data);

    if (!result.ok) return formError(result.error.message, result.error.fields);

    revalidatePath(`/admin/categories/${categoryId}`);

    const { added, requested } = result.value;

    // The count is the honest one, not the one that was asked for. A model that
    // returned six usable questions out of ten, or an insert that dropped one,
    // has to show up here rather than in a log nobody reads.
    return formSuccess(
        added === requested
            ? `${added} draft${added === 1 ? '' : 's'} added below — review, then activate.`
            : `${added} of ${requested} drafts were usable and are below — review, then activate.`,
    );
}

/**
 * Reject a draft (SP-092 AC3).
 *
 * A real delete, and the only one in this file. The service refuses anything
 * that is not an inactive AI draft, so the worst a forged questionId achieves
 * is a sentence explaining that.
 */
export async function deleteQuestionAction(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const parsed = z
        .object({
            questionId: z.coerce.number().int().positive(),
            categoryId: z.coerce.number().int().positive(),
        })
        .safeParse({
            questionId: formData.get('questionId'),
            categoryId: formData.get('categoryId'),
        });

    if (!parsed.success) return formError('That draft could not be deleted.');

    const result = await questionService.deleteDraftQuestion(parsed.data.questionId);

    if (!result.ok) return formError(result.error.message, result.error.fields);

    revalidatePath(`/admin/categories/${parsed.data.categoryId}`);

    return formSuccess('Draft deleted.');
}
