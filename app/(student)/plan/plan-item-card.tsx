/**
 * One plan item — client component.
 *
 * Stories: SP-062, SP-063
 *
 * Title, status chip, descriptions, and the one control: a status that moves
 * not started -> in progress -> completed -> (reopen). Marking an item complete
 * awards XP, but not from here: the trigger in 0002_functions.sql fires on the
 * row change itself, so the XP cannot be missed by a code path that forgot to
 * ask for it — and cannot be paid twice by un-ticking and re-ticking.
 */

'use client';

import { useActionState } from 'react';
import { updatePlanStatusAction } from './actions';
import { IDLE } from '../../../lib/validation/common';
import { Chip } from '../../../components/ui/chip';
import { SubmitButton } from '../../../components/submit-button';
import { FormStatus } from '../../../components/form-status';
import { PLAN_STATUS_LABELS } from '../../../lib/domain/constants';
import type { PlanItem, PlanStatus } from '../../../lib/domain/types';

const NEXT_STATUS: Record<PlanStatus, { next: PlanStatus; label: string }> = {
    not_started: { next: 'in_progress', label: 'Start' },
    in_progress: { next: 'completed', label: 'Mark done' },
    completed: { next: 'not_started', label: 'Reopen' },
};

export function PlanItemCard({ item }: { item: PlanItem }) {
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
                    rather than blank (SP-091 AC3). */}
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
