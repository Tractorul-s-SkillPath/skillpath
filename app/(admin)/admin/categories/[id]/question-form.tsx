/**
 * Add a question to one category.
 *
 * Story: SP-034
 *
 * The radio group is what makes "exactly one correct answer" true in the UI —
 * a checkbox per option would let an admin tick two, and the unique index
 * `answers_one_correct_per_question` would then reject the whole write with a
 * constraint error they cannot act on. Say it once, in the control.
 *
 * `categoryId` travels as a hidden input rather than through `.bind()`, so the
 * action keeps the plain `(prevState, formData)` shape every other action in
 * this codebase has and the schema validates it like any other field.
 */

'use client';

import { useActionState, useEffect, useRef } from 'react';
import { createQuestionAction } from './actions';
import { IDLE } from '../../../../../lib/validation/common';
import { Field, Input } from '../../../../../components/ui/field';
import { SubmitButton } from '../../../../../components/submit-button';
import { FormStatus } from '../../../../../components/form-status';
import { QUESTION_TEXT_MAX } from '../../../../../lib/validation/question.schema';

const OPTIONS = [0, 1, 2, 3];

export function QuestionForm({ categoryId }: { categoryId: number }) {
    const [state, formAction] = useActionState(createQuestionAction, IDLE);
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state.status === 'success') formRef.current?.reset();
    }, [state.status]);

    return (
        <form ref={formRef} action={formAction} className="space-y-4">
            <input type="hidden" name="categoryId" value={categoryId} />

            <Field label="Question" htmlFor="question-text" error={state.fields?.text}>
                <textarea
                    id="question-text"
                    name="text"
                    required
                    rows={3}
                    maxLength={QUESTION_TEXT_MAX}
                    placeholder="What does useState return?"
                    className="w-full resize-none rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle-foreground"
                />
            </Field>

            <Field label="Difficulty" htmlFor="question-difficulty" error={state.fields?.difficulty}>
                <select
                    id="question-difficulty"
                    name="difficulty"
                    defaultValue="beginner"
                    className="h-9.5 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-foreground"
                >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                </select>
            </Field>

            <fieldset className="space-y-2">
                <legend className="text-[0.8125rem] font-medium text-foreground">
                    Options — select the correct one
                </legend>

                {OPTIONS.map((index) => (
                    <div key={index} className="flex items-center gap-2.5">
                        <input
                            type="radio"
                            name="correctOption"
                            value={index}
                            required
                            aria-label={`Option ${index + 1} is the correct answer`}
                            className="size-4 shrink-0 accent-[color:var(--accent)]"
                        />
                        <Input
                            name={`option_${index}`}
                            required
                            maxLength={500}
                            placeholder={`Option ${index + 1}`}
                            aria-label={`Option ${index + 1}`}
                        />
                    </div>
                ))}

                {/*
                  The schema reports "exactly one correct" and "options must
                  differ" against the `answers` path, so both land here rather
                  than beside one arbitrary input.
                */}
                {state.fields?.answers ? (
                    <p role="alert" className="text-xs text-danger">
                        {state.fields.answers}
                    </p>
                ) : null}
            </fieldset>

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
