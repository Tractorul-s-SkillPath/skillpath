/**
 * Generate draft questions with AI.
 *
 * Story: SP-092
 *
 * Three controls, because the story asks for three: a difficulty, a count, and
 * a button. The category comes from the route, not from a field — an admin
 * looking at one category's bank is not choosing which bank to write into.
 *
 * The drafts do not appear here. They appear in the bank beside this form,
 * inactive and labelled `AI draft`, which is the whole review step: the same
 * Edit, Activate and Delete controls a hand-written question has, working on a
 * draft with no second UI to keep in step.
 *
 * FormState is the shape every form in this app reads, so a failed generation
 * renders through FormStatus exactly like a failed save — which is what makes
 * "the admin sees a message, never a 500" (AC4) a property of the plumbing
 * rather than of this component remembering to handle it.
 */

'use client';

import { useActionState } from 'react';
import { generateQuestionsAction } from './actions';
import { IDLE } from '../../../../../lib/validation/common';
import {
    GENERATE_COUNT_DEFAULT,
    GENERATE_COUNT_MAX,
    GENERATE_COUNT_MIN,
} from '../../../../../lib/validation/question.schema';
import { Field } from '../../../../../components/ui/field';
import { SubmitButton } from '../../../../../components/submit-button';
import { FormStatus } from '../../../../../components/form-status';

const CONTROL_CLASS =
    'w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground ' +
    'transition-colors hover:border-[color:var(--accent)]';

export function GenerateQuestionsForm({ categoryId }: { categoryId: number }) {
    const action = generateQuestionsAction.bind(null, categoryId);
    const [state, formAction] = useActionState(action, IDLE);

    return (
        <form action={formAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <Field
                    label="Difficulty"
                    htmlFor="generate-difficulty"
                    error={state.fields?.difficulty}
                >
                    <select
                        id="generate-difficulty"
                        name="difficulty"
                        defaultValue="beginner"
                        className={CONTROL_CLASS}
                    >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                    </select>
                </Field>

                <Field
                    label="How many"
                    htmlFor="generate-count"
                    error={state.fields?.count}
                    hint={`${GENERATE_COUNT_MIN}–${GENERATE_COUNT_MAX}`}
                >
                    <input
                        id="generate-count"
                        name="count"
                        type="number"
                        min={GENERATE_COUNT_MIN}
                        max={GENERATE_COUNT_MAX}
                        defaultValue={GENERATE_COUNT_DEFAULT}
                        className={CONTROL_CLASS}
                    />
                </Field>
            </div>

            <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
                Drafts arrive inactive and marked <span className="font-medium">AI draft</span>.
                Nothing reaches a student until you activate it.
            </p>

            <FormStatus state={state} />

            <SubmitButton variant="primary" pendingLabel="Generating…">
                Generate drafts
            </SubmitButton>
        </form>
    );
}
