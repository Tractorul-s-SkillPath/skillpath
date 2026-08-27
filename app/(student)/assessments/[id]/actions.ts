/**
 * Run actions — save one answer, submit the paper.
 *
 * Layer: ACTION
 * Stories: SP-043, SP-046, SP-115
 *
 * Both are called programmatically from the runner rather than through a
 * <form>, so they take plain arguments and return a small result object —
 * except submitAssessment, which on success does not return at all: it
 * redirects to the results, and redirect() throws by design.
 */

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { assertAuth } from '../../../../lib/auth/assertAuth';
import { saveAnswer } from '../../../../lib/services/assessment.service';
import { submit } from '../../../../lib/services/grading.service';
import { saveAnswerSchema, submitSchema } from '../../../../lib/validation/assessment.schema';

export interface ActionResult {
    ok: boolean;
    message?: string;
}

export async function saveAnswerAction(
    assessmentId: number,
    questionId: number,
    answerId: number,
): Promise<ActionResult> {
    const user = await assertAuth();

    const parsed = saveAnswerSchema.safeParse({ assessmentId, questionId, answerId });
    if (!parsed.success) return { ok: false, message: 'That answer could not be saved.' };

    const saved = await saveAnswer(
        user.userId,
        parsed.data.assessmentId,
        parsed.data.questionId,
        parsed.data.answerId,
    );

    return saved.ok ? { ok: true } : { ok: false, message: saved.error.message };
}

export async function submitAssessmentAction(assessmentId: number): Promise<ActionResult> {
    const user = await assertAuth();

    const parsed = submitSchema.safeParse({ assessmentId });
    if (!parsed.success) return { ok: false, message: 'That assessment could not be submitted.' };

    const submitted = await submit(user.userId, parsed.data.assessmentId);

    if (!submitted.ok) {
        // 'conflict' means it IS submitted — a double-fire from the timer plus
        // a click, or a second tab. The right place is still the results.
        if (submitted.error.code === 'conflict') {
            redirect(`/assessments/${parsed.data.assessmentId}/results`);
        }
        return { ok: false, message: submitted.error.message };
    }

    // The dashboard's card, tiles and category list all just changed.
    revalidatePath('/dashboard');
    revalidatePath('/profile');
    revalidatePath('/plan');

    redirect(`/assessments/${parsed.data.assessmentId}/results`);
}
