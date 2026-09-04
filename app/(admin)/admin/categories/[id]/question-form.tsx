/**
 * Add a question to this category.
 *
 * Stories: SP-034, SP-035, SP-036
 *
 * useActionState carries back a FormState, the same shape every other form in
 * the app reads. The previous version invented `{ success, error }` for these
 * two screens alone, which is what stopped the build: FormStatus, Field and
 * SubmitButton all speak FormState.
 *
 * On success the form clears. `formKey` is what clears it — form.reset() puts
 * the text inputs back but cannot tell AnswerRows to drop back to two rows,
 * because that count is React state rather than DOM state.
 */

'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { createQuestionAction } from './actions';
import { AnswerRows } from './answer-rows';
import { IDLE } from '../../../../../lib/validation/common';
import { QUESTION_TEXT_MAX } from '../../../../../lib/validation/question.schema';
import { Field } from '../../../../../components/ui/field';
import { SubmitButton } from '../../../../../components/submit-button';
import { FormStatus } from '../../../../../components/form-status';

const SELECT_CLASS =
    'w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground ' +
    'transition-colors hover:border-[color:var(--accent)]';

const TEXTAREA_CLASS =
    'w-full resize-none rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm ' +
    'text-foreground placeholder:text-subtle-foreground transition-colors ' +
    'hover:border-[color:var(--accent)] aria-[invalid=true]:border-[color:var(--danger)]';

export function QuestionForm({ categoryId }: { categoryId: number }) {
    const action = createQuestionAction.bind(null, categoryId);
    const [state, formAction] = useActionState(action, IDLE);
    const formRef = useRef<HTMLFormElement>(null);
    const [formKey, setFormKey] = useState(0);

    useEffect(() => {
        if (state.status === 'success') {
            formRef.current?.reset();
            setFormKey((current) => current + 1);
        }
    }, [state.status]);

    return (
        <form ref={formRef} action={formAction} className="space-y-4">
            <Field
                label="Question"
                htmlFor="question-text"
                error={state.fields?.text}
                hint={`up to ${QUESTION_TEXT_MAX}`}
            >
                <textarea
                    id="question-text"
                    name="text"
                    rows={3}
                    required
                    maxLength={QUESTION_TEXT_MAX}
                    placeholder="What does `useActionState` return?"
                    className={TEXTAREA_CLASS}
                />
            </Field>

            <Field
                label="Difficulty"
                htmlFor="question-difficulty"
                error={state.fields?.difficulty}
            >
                <select
                    id="question-difficulty"
                    name="difficulty"
                    required
                    className={SELECT_CLASS}
                >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                </select>
            </Field>

            <AnswerRows key={formKey} fields={state.fields} />

            <div className="flex items-center justify-between gap-3">
                <FormStatus state={state} />
                <SubmitButton variant="primary" pendingLabel="Saving…">
                    Add question
                </SubmitButton>
            </div>
        </form>
    );
}

export default QuestionForm;
