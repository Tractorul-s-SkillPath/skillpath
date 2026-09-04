/**
 * AnswerRows — the option list both question forms share.
 *
 * Stories: SP-034, SP-035, SP-036
 *
 * Create and edit were two copies of this markup that had already drifted
 * apart: one capped the options at four and the other opened at however many
 * the question happened to have, so the same question could be written in the
 * create form and then not fit in the edit form. One component, one cap.
 *
 * The checkboxes are checkboxes rather than radios because a question may have
 * more than one correct option (question.schema.ts). Radios would make the
 * second correct answer unexpressible in the UI while the schema accepted it.
 *
 * Uncontrolled on purpose: the inputs carry their own values and the server
 * action reads them off FormData by name. The only state here is how many rows
 * are on screen. A parent that needs to clear them remounts with a new `key`.
 */

'use client';

import { useState } from 'react';
import { Button } from '../../../../../components/ui/button';
import { Input } from '../../../../../components/ui/field';
import { ANSWERS_MIN, ANSWERS_MAX } from '../../../../../lib/validation/question.schema';

export interface AnswerDefault {
    text: string;
    isCorrect: boolean;
}

interface AnswerRowsProps {
    /** The existing options when editing. Empty when creating. */
    defaults?: readonly AnswerDefault[];
    /** Field errors from the action, keyed as zod paths them. */
    fields?: Record<string, string>;
}

function clamp(value: number) {
    return Math.min(Math.max(value, ANSWERS_MIN), ANSWERS_MAX);
}

export function AnswerRows({ defaults = [], fields }: AnswerRowsProps) {
    const [count, setCount] = useState(() => clamp(defaults.length));

    // Zod reports the "at least one correct" and "all correct" refinements
    // against the array itself, and a bad individual option against its index.
    const listError = fields?.answers;

    return (
        <fieldset className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-2">
                <legend className="text-[0.8125rem] font-medium text-foreground">
                    Options
                    <span className="ml-2 font-normal text-subtle-foreground">
                        tick every correct one
                    </span>
                </legend>

                <div className="flex gap-2">
                    <Button
                        size="sm"
                        onClick={() => setCount((current) => clamp(current - 1))}
                        disabled={count <= ANSWERS_MIN}
                        aria-label="Remove the last option"
                    >
                        −
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => setCount((current) => clamp(current + 1))}
                        disabled={count >= ANSWERS_MAX}
                        aria-label="Add another option"
                    >
                        +
                    </Button>
                </div>
            </div>

            {Array.from({ length: count }).map((_, index) => {
                const existing = defaults[index];
                const rowError = fields?.[`answers.${index}.text`];
                const rowId = `option-text-${index}`;

                return (
                    <div key={index} className="space-y-1.5">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id={`option-correct-${index}`}
                                name={`option_correct_${index}`}
                                value="true"
                                defaultChecked={existing?.isCorrect ?? false}
                                className="size-4.5 shrink-0 cursor-pointer rounded border-border-strong accent-[color:var(--accent)]"
                                aria-label={`Option ${index + 1} is correct`}
                            />
                            <Input
                                id={rowId}
                                name={`option_text_${index}`}
                                defaultValue={existing?.text ?? ''}
                                maxLength={500}
                                placeholder={`Option ${index + 1}`}
                                aria-invalid={rowError ? true : undefined}
                                aria-describedby={rowError ? `${rowId}-error` : undefined}
                            />
                        </div>

                        {rowError ? (
                            <p
                                id={`${rowId}-error`}
                                className="pl-7.5 text-xs text-danger"
                                role="alert"
                            >
                                {rowError}
                            </p>
                        ) : null}
                    </div>
                );
            })}

            {listError ? (
                <p className="text-xs text-danger" role="alert">
                    {listError}
                </p>
            ) : null}
        </fieldset>
    );
}

export default AnswerRows;
