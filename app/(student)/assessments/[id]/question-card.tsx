/**
 * One question of the paper — a radio group wearing card clothes.
 *
 * Story: SP-043
 *
 * Real <input type="radio"> per option, grouped by question id: arrow keys,
 * labels and form semantics come free, and "which option is picked" is the
 * input's own state mirrored from the server row, not a div pretending.
 */

'use client';

import * as React from 'react';
import type { RunQuestion } from '../../../../lib/domain/types';
import { cn } from '../../../../lib/utils';

interface QuestionCardProps {
    question: RunQuestion;
    selectedAnswerId: number | null;
    onSelect: (answerId: number) => void;
    disabled: boolean;
}

export function QuestionCard({ question, selectedAnswerId, onSelect, disabled }: QuestionCardProps) {
    const groupName = `question-${question.questionId}`;

    return (
        <fieldset
            id={`q-${question.position}`}
            disabled={disabled}
            className="rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:p-5"
        >
            <legend className="float-left mb-3 w-full">
                <span className="text-xs font-medium uppercase tracking-wide text-subtle-foreground tabular">
                    Question {question.position}
                </span>
                <span className="mt-1 block text-sm font-medium leading-relaxed text-foreground">
                    {question.text}
                </span>
            </legend>

            <div className="clear-both space-y-2">
                {question.options.map((option) => {
                    const checked = option.answerId === selectedAnswerId;

                    return (
                        <label
                            key={option.answerId}
                            className={cn(
                                'flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors',
                                checked
                                    ? 'border-accent bg-accent-soft text-foreground'
                                    : 'border-border text-muted-foreground hover:border-border-strong hover:bg-surface-muted',
                                disabled && 'cursor-not-allowed opacity-70',
                            )}
                        >
                            <input
                                type="radio"
                                name={groupName}
                                checked={checked}
                                onChange={() => onSelect(option.answerId)}
                                className="size-4 shrink-0 accent-[var(--color-accent)]"
                            />
                            <span>{option.text}</span>
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}
