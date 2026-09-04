/**
 * Interests, each with its level — client component.
 *
 * Stories: SP-022, SP-109
 *
 * This is where a member says what they are working on AND what level they
 * consider themselves. Both are the same row: a category_progress row is the
 * interest, and its current_level is the answer. Removing an interest deletes
 * that row and the level with it, which the confirm copy says out loud.
 *
 * An assessment writes the same column, so a result overwrites a self-declared
 * level rather than sitting next to it — one answer to "what level am I".
 */

'use client';

import * as React from 'react';
import { useActionState, useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { setCategoryLevelAction, updateInterestsAction } from './actions';
import { IDLE } from '../../../lib/validation/common';
import { Section } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/empty-state';
import { SubmitButton } from '../../../components/submit-button';
import { FormStatus } from '../../../components/form-status';
import { LEVEL_LABELS } from '../../../lib/domain/constants';
import { formatDate, formatScore } from '../../../lib/utils';
import type { Interest, SkillCategory, SkillLevel } from '../../../lib/domain/types';

const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced'];

function LevelPicker({ interest }: { interest: Interest }) {
    const [state, formAction] = useActionState(setCategoryLevelAction, IDLE);

    return (
        <form action={formAction} className="flex items-center gap-1">
            <input type="hidden" name="categoryId" value={interest.categoryId} />

            {LEVELS.map((level) => {
                const active = interest.level === level;

                return (
                    <SubmitButton
                        key={level}
                        name="level"
                        value={level}
                        size="sm"
                        variant={active ? 'primary' : 'ghost'}
                        aria-pressed={active}
                        // The visible label is truncated to three characters to
                        // fit the row. Without this a screen reader announces
                        // "Beg", "Int", "Adv".
                        aria-label={`Set ${interest.name} to ${LEVEL_LABELS[level]}`}
                        className="px-2.5"
                    >
                        <span aria-hidden="true">{LEVEL_LABELS[level].slice(0, 3)}</span>
                    </SubmitButton>
                );
            })}

            <FormStatus state={state} className="ml-1 text-xs" />
        </form>
    );
}

interface InterestsSectionProps {
    interests: Interest[];
    catalog: SkillCategory[];
}

export function InterestsSection({ interests, catalog }: InterestsSectionProps) {
    const [editing, setEditing] = useState(false);
    const [selected, setSelected] = useState<number[]>(() => interests.map((i) => i.categoryId));
    const [state, formAction] = useActionState(updateInterestsAction, IDLE);

    React.useEffect(() => {
        if (state.status === 'success') setEditing(false);
    }, [state.status]);

    function toggle(categoryId: number) {
        setSelected((current) =>
            current.includes(categoryId)
                ? current.filter((id) => id !== categoryId)
                : [...current, categoryId],
        );
    }

    const removing = interests.filter((i) => !selected.includes(i.categoryId));

    return (
        <Section
            id="interests"
            title="Interests and levels"
            description="What you're working on, and where you'd put yourself in each."
            action={
                editing ? null : (
                    <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                        <Pencil size={14} strokeWidth={1.75} />
                        Edit
                    </Button>
                )
            }
        >
            {editing ? (
                <form action={formAction} className="space-y-4">
                    {selected.map((id) => (
                        <input key={id} type="hidden" name="categoryIds" value={id} />
                    ))}

                    {catalog.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No categories exist yet. An admin needs to add some first.
                        </p>
                    ) : (
                        <div
                            role="group"
                            aria-label="Categories you want to be assessed on"
                            className="flex flex-wrap gap-2"
                        >
                            {catalog.map((category) => {
                                const on = selected.includes(category.categoryId);

                                return (
                                    <button
                                        key={category.categoryId}
                                        type="button"
                                        role="checkbox"
                                        aria-checked={on}
                                        onClick={() => toggle(category.categoryId)}
                                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                                            on
                                                ? 'border-[color:var(--accent)] bg-accent-soft text-[color:var(--accent-hover)]'
                                                : 'border-border-strong bg-surface text-muted-foreground hover:bg-surface-muted'
                                        }`}
                                    >
                                        {on ? <Check size={13} strokeWidth={2.25} /> : null}
                                        {category.name}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {removing.length > 0 ? (
                        <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                            Removing {removing.map((i) => i.name).join(', ')} also discards the
                            level recorded for {removing.length === 1 ? 'it' : 'them'}.
                        </p>
                    ) : null}

                    <FormStatus state={state} />

                    <div className="flex gap-2">
                        <SubmitButton size="sm" variant="primary" pendingLabel="Saving…">
                            Save interests
                        </SubmitButton>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setSelected(interests.map((i) => i.categoryId));
                                setEditing(false);
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            ) : interests.length === 0 ? (
                <EmptyState
                    title="No interests yet"
                    description="Pick the areas you want to be assessed on. Everything else on this page follows from them."
                    action={
                        <Button size="sm" variant="primary" onClick={() => setEditing(true)}>
                            Choose interests
                        </Button>
                    }
                />
            ) : (
                <ul className="divide-y divide-border">
                    {interests.map((interest) => (
                        <li
                            key={interest.categoryId}
                            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                        >
                            <div className="min-w-0">
                                <span className="text-sm font-medium">{interest.name}</span>
                                <p className="mt-0.5 text-xs text-subtle-foreground tabular">
                                    {interest.lastScore === null
                                        ? 'Not assessed yet'
                                        : `Last score ${formatScore(interest.lastScore)} · ${formatDate(interest.assessedAt)}`}
                                </p>
                            </div>

                            <LevelPicker interest={interest} />
                        </li>
                    ))}
                </ul>
            )}
        </Section>
    );
}
