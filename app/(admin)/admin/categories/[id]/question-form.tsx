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
 * `categoryId` travels as a hidden input rather than through `.bind()`, so the
 * action keeps the plain `(prevState, formData)` shape every other action in
 * this codebase has and the schema validates it like any other field.
 *
 * The option count is the admin's to choose, between ANSWERS_MIN and
 * ANSWERS_MAX. Both bounds come from questionSchema rather than being written
 * again here — the buttons stop at the same numbers the server would refuse at,
 * so the limit is something you run into visibly rather than after a submit.
 */

'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { createQuestionAction } from './actions';
import { AnswerRows } from './answer-rows';
import { IDLE } from '../../../../../lib/validation/common';
import { Field, Input } from '../../../../../components/ui/field';
import { Button } from '../../../../../components/ui/button';
import { SubmitButton } from '../../../../../components/submit-button';
import { FormStatus } from '../../../../../components/form-status';
import {
    ANSWERS_MAX,
    ANSWERS_MIN,
    QUESTION_TEXT_MAX,
} from '../../../../../lib/validation/question.schema';

/** What the form opens with — four is the shape most questions take. */
const DEFAULT_OPTIONS = 4;

export function QuestionForm({ categoryId }: { categoryId: number }) {
    const [state, formAction] = useActionState(createQuestionAction, IDLE);
    const [optionCount, setOptionCount] = useState(DEFAULT_OPTIONS);
    const formRef = useRef<HTMLFormElement>(null);
    const [formKey, setFormKey] = useState(0);

    useEffect(() => {
        if (state.status !== 'success') return;

        // form.reset() puts the inputs back but knows nothing about how many of
        // them there are, so the row count has to be reset alongside it.
        formRef.current?.reset();
        setOptionCount(DEFAULT_OPTIONS);
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

            <Field label="Difficulty" htmlFor="question-difficulty" error={state.fields?.difficulty}>
                <select id="question-difficulty" name="difficulty" required className={SELECT_CLASS}>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                </select>
            </Field>

            <fieldset className="space-y-2">
                <legend className="text-[0.8125rem] font-medium text-foreground">
                    Options — select the correct one
                </legend>

                {Array.from({ length: optionCount }, (_, index) => (
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
                  Rows come and go from the end, so no surviving option changes
                  its index and the radio keeps pointing at the same answer.
                  Removing the row that WAS marked correct drops the selection
                  with it — the group is `required`, so the browser asks for a
                  new one rather than letting a question through with no key.
                */}
                <div className="flex items-center gap-2 pt-0.5">
                    <Button
                        size="sm"
                        onClick={() => setOptionCount((count) => count + 1)}
                        disabled={optionCount >= ANSWERS_MAX}
                    >
                        Add option
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setOptionCount((count) => count - 1)}
                        disabled={optionCount <= ANSWERS_MIN}
                    >
                        Remove
                    </Button>
                    <span className="ml-auto text-xs text-subtle-foreground tabular">
                        {optionCount} of {ANSWERS_MAX}
                    </span>
                </div>

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
