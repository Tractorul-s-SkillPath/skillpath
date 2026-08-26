/**
 * Question bank actions, scoped to one category.
 *
 * Layer: ACTION
 * Stories: SP-034, SP-035, SP-036
 *
 * The option inputs are collected into an array here and handed to
 * questionSchema, which is where "exactly one correct answer" is enforced —
 * next to `answers_one_correct_per_question` in 0001, which enforces the same
 * thing for callers that never come through this file.
 *
 * How MANY options arrive is the form's business, not this file's: it renders
 * between ANSWERS_MIN and ANSWERS_MAX rows and the admin adds or removes them.
 * The bounds are enforced by the schema rather than here, so a post that skips
 * the form entirely is held to the same rule as one that came through it.
 *
 * `created_by` is NOT read from the form. The service takes it from the session
 * (§5), the same way every user-scoped write in this codebase does.
 *
 * Test: tests/app/(admin)/admin/categories/[id]/actions.test.ts
 */

'use server';

import { revalidatePath } from 'next/cache';
import * as questionService from '../../../../../lib/services/question.service';
import { ANSWERS_MAX, questionSchema } from '../../../../../lib/validation/question.schema';
import {
    fieldErrors,
    formError,
    formSuccess,
    type FormState,
} from '../../../../../lib/validation/common';

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

    // The form posts however many rows it is currently showing, as option_0 …
    // option_n, so read the whole range it could have sent and keep the
    // indices that actually arrived.
    //
    // The surviving indices are NOT renumbered. `correctOption` points at one
    // of them, and closing a gap would slide that pointer onto a different
    // option — a question stored with the wrong answer key, which is the one
    // kind of bug here that a student sees and an admin does not.
    //
    // Too few options or too many is left to questionSchema. Clamping silently
    // would store a question the admin did not write.
    const answers = Array.from({ length: ANSWERS_MAX }, (_, index) => index)
        .filter((index) => formData.has(`option_${index}`))
        .map((index) => ({
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
