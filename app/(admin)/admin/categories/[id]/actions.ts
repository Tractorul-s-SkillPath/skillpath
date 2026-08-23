/**
 * Question bank actions, scoped to one category.
 *
 * Layer: ACTION
 * Stories: SP-034, SP-035, SP-036
 *
 * The four option inputs are collected into an array here and handed to
 * questionSchema, which is where "exactly one correct answer" is enforced —
 * next to `answers_one_correct_per_question` in 0001, which enforces the same
 * thing for callers that never come through this file.
 *
 * `created_by` is NOT read from the form. The service takes it from the session
 * (§5), the same way every user-scoped write in this codebase does.
 *
 * Test: tests/app/(admin)/admin/categories/[id]/actions.test.ts
 */

'use server';

import { revalidatePath } from 'next/cache';
import * as questionService from '../../../../../lib/services/question.service';
import { questionSchema } from '../../../../../lib/validation/question.schema';
import {
    fieldErrors,
    formError,
    formSuccess,
    type FormState,
} from '../../../../../lib/validation/common';

/** How many option inputs the form renders. */
const OPTION_COUNT = 4;

export async function createQuestionAction(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    // The radio group carries which option is right. It is `required` in the
    // form, but a form is a suggestion — a post without it must be rejected
    // here rather than producing a question with no correct answer.
    //
    // The parse is deliberately strict. `Number(null)` is 0, not NaN, so a post
    // that omits the field entirely would silently mark the FIRST option as the
    // correct one — a question nobody chose an answer for, stored as though
    // somebody had. -1 matches no option, so the "exactly one correct" refine
    // in questionSchema rejects it and says so.
    const rawCorrect = String(formData.get('correctOption') ?? '').trim();
    const correctIndex = /^\d+$/.test(rawCorrect) ? Number(rawCorrect) : -1;

    const answers = Array.from({ length: OPTION_COUNT }, (_, index) => ({
        text: String(formData.get(`option_${index}`) ?? ''),
        isCorrect: index === correctIndex,
    }));

    const parsed = questionSchema.safeParse({
        categoryId: formData.get('categoryId'),
        text: formData.get('text') ?? '',
        difficulty: formData.get('difficulty'),
        answers,
    });

    if (!parsed.success) return formError('Check the fields below.', fieldErrors(parsed.error));

    const result = await questionService.createQuestion(parsed.data);

    if (!result.ok) return formError(result.error.message, result.error.fields);

    revalidatePath(`/admin/categories/${parsed.data.categoryId}`);
    // The catalog shows a question count per category, so it is stale now too.
    revalidatePath('/admin/categories');

    return formSuccess('Question added.');
}
