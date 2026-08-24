/**
 * Learning plan — client component.
 *
 * Stories: SP-061, SP-062
 *
 * Grouped by category, priority first. Marking an item complete awards XP, but
 * not from here: the trigger in 0002_functions.sql fires on the row change
 * itself, so the XP cannot be missed by a code path that forgot to ask for it —
 * and cannot be paid twice by un-ticking and re-ticking.
 */

'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { Route } from 'lucide-react';
import { updatePlanStatusAction } from './actions';
import { IDLE } from '../../../lib/validation/common';
import { Section } from '../../../components/ui/card';
import { Chip } from '../../../components/ui/chip';
import { EmptyState } from '../../../components/empty-state';
import { SubmitButton } from '../../../components/submit-button';
import { FormStatus } from '../../../components/form-status';
import { PLAN_STATUS_LABELS } from '../../../lib/domain/constants';
import type { PlanItem, PlanStatus } from '../../../lib/domain/types';

const NEXT_STATUS: Record<PlanStatus, { next: PlanStatus; label: string }> = {
    not_started: { next: 'in_progress', label: 'Start' },
    in_progress: { next: 'completed', label: 'Mark done' },
    completed: { next: 'not_started', label: 'Reopen' },
};

function PlanRow({ item }: { item: PlanItem }) {
    const [state, formAction] = useActionState(updatePlanStatusAction, IDLE);
    const transition = NEXT_STATUS[item.status];

    return (
        <li className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={`text-sm font-medium ${
                            item.status === 'completed'
                                ? 'text-muted-foreground line-through'
                                : 'text-foreground'
                        }`}
                    >
                        {item.topicTitle}
                    </span>
                    <Chip
                        tone={
                            item.status === 'completed'
                                ? 'success'
                                : item.status === 'in_progress'
                                  ? 'accent'
                                  : 'muted'
                        }
                    >
                        {PLAN_STATUS_LABELS[item.status]}
                    </Chip>
                </div>

                {/* Rule-based text first and always; the AI elaboration is
                    decoration, so a provider outage leaves the item complete
                    rather than blank. */}
                {item.description ? (
                    <p className="mt-1 max-w-prose text-[0.8125rem] leading-relaxed text-muted-foreground">
                        {item.description}
                    </p>
                ) : null}

                {item.aiDescription ? (
                    <p className="mt-1.5 max-w-prose text-[0.8125rem] leading-relaxed text-subtle-foreground">
                        {item.aiDescription}
                    </p>
                ) : null}

                <FormStatus state={state} className="mt-1 text-xs" />
            </div>

            <form action={formAction} className="shrink-0">
                <input type="hidden" name="recommendationId" value={item.recommendationId} />
                <input type="hidden" name="status" value={transition.next} />
                <SubmitButton
                    size="sm"
                    variant={item.status === 'in_progress' ? 'primary' : 'secondary'}
                    pendingLabel="Saving…"
                    aria-label={`${transition.label}: ${item.topicTitle}`}
                >
                    {transition.label}
                </SubmitButton>
            </form>
        </li>
    );
}

export function PlanSection({ plan }: { plan: PlanItem[] }) {
    const byCategory = React.useMemo(() => {
        const groups = new Map<string, PlanItem[]>();
        for (const item of plan) {
            const existing = groups.get(item.categoryName);
            if (existing) existing.push(item);
            else groups.set(item.categoryName, [item]);
        }
        return [...groups.entries()];
    }, [plan]);

    const done = plan.filter((item) => item.status === 'completed').length;

    return (
        <Section
            id="plan"
            title="Learning plan"
            description="Generated from your weak areas. Highest priority first."
            action={
                plan.length > 0 ? (
                    <span className="text-xs text-muted-foreground tabular">
                        {done} of {plan.length} done
                    </span>
                ) : null
            }
        >
            {plan.length === 0 ? (
                <EmptyState
                    icon={<Route size={22} strokeWidth={1.5} />}
                    title="No plan yet"
                    description="Finish an assessment and SkillPath builds one from whatever it finds you're weakest at."
                />
            ) : (
                <div className="space-y-6">
                    {byCategory.map(([categoryName, items]) => (
                        <div key={categoryName}>
                            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
                                {categoryName}
                            </h3>
                            <ul className="divide-y divide-border">
                                {items.map((item) => (
                                    <PlanRow key={item.recommendationId} item={item} />
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </Section>
    );
}
