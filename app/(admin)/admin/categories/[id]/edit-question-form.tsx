/**
 * Edit one question, in place in the list.
 *
 * Stories: SP-034, SP-035, SP-036
 *
 * Saving writes a new question and retires this one — see the note on
 * editQuestionAction. The redirect back to the plain list lives in the action
 * too, rather than `window.location.href = ...` in an effect here: a full page
 * load threw away the router cache and the scroll position on every save, and
 * it fired on a state shape (`state.success`) this form no longer receives.
 */

'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { editQuestionAction } from './actions';
import { AnswerRows } from './answer-rows';
import { IDLE } from '../../../../../lib/validation/common';
import { QUESTION_TEXT_MAX } from '../../../../../lib/validation/question.schema';
import { Field } from '../../../../../components/ui/field';
import { SubmitButton } from '../../../../../components/submit-button';
import { FormStatus } from '../../../../../components/form-status';
import { buttonClass } from '../../../../../components/ui/button';
import type { AdminQuestion } from '../../../../../lib/domain/types';

const SELECT_CLASS =
    'w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground ' +
    'transition-colors hover:border-[color:var(--accent)]';

const TEXTAREA_CLASS =
    'w-full resize-none rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm ' +
    'text-foreground placeholder:text-subtle-foreground transition-colors ' +
    'hover:border-[color:var(--accent)] aria-[invalid=true]:border-[color:var(--danger)]';

interface EditQuestionFormProps {
    question: AdminQuestion;
    categoryId: number;
}

export function EditQuestionForm({ question, categoryId }: EditQuestionFormProps) {
    const action = editQuestionAction.bind(null, question.questionId, categoryId);
    const [state, formAction] = useActionState(action, IDLE);

    return (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface-muted p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                    Edit question
                </h3>
                <Link
                    href={`/admin/categories/${categoryId}`}
                    className={buttonClass('ghost', 'sm')}
                >
                    Cancel
                </Link>
            </div>

            <form action={formAction} className="space-y-4">
                <Field
                    label="Question"
                    htmlFor={`edit-text-${question.questionId}`}
                    error={state.fields?.text}
                    hint={`up to ${QUESTION_TEXT_MAX}`}
                >
                    <textarea
                        id={`edit-text-${question.questionId}`}
                        name="text"
                        rows={3}
                        required
                        maxLength={QUESTION_TEXT_MAX}
                        defaultValue={question.text}
                        className={TEXTAREA_CLASS}
                    />
                </Field>

                <Field
                    label="Difficulty"
                    htmlFor={`edit-difficulty-${question.questionId}`}
                    error={state.fields?.difficulty}
                >
                    <select
                        id={`edit-difficulty-${question.questionId}`}
                        name="difficulty"
                        required
                        defaultValue={question.difficulty}
                        className={SELECT_CLASS}
                    >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                    </select>
                </Field>

                <AnswerRows defaults={question.answers} fields={state.fields} />

                <div className="flex items-center justify-between gap-3">
                    <FormStatus state={state} />
                    <SubmitButton variant="primary" pendingLabel="Saving…">
                        Save changes
                    </SubmitButton>
                </div>
            </form>
        </div>
    );
}

export default EditQuestionForm;
