/**
 * Assessment history.
 *
 * Story: SP-020
 *
 * Newest first. No assessments is an empty state, not an error (SP-020 AC2) —
 * a brand-new member is the common case here, not the edge case.
 */

import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';
import { Section } from '../../../components/ui/card';
import { Chip } from '../../../components/ui/chip';
import { EmptyState } from '../../../components/empty-state';
import { buttonClass } from '../../../components/ui/button';
import { LEVEL_LABELS } from '../../../lib/domain/constants';
import { formatDate, formatScore } from '../../../lib/utils';
import type { AssessmentSummary } from '../../../lib/domain/types';

export function AssessmentHistory({ assessments }: { assessments: AssessmentSummary[] }) {
    const finished = assessments.filter((a) => a.status === 'submitted');
    const open = assessments.filter((a) => a.status === 'in_progress');

    return (
        <Section
            id="assessments"
            title="Assessments"
            description="Everything you've taken, newest first."
            action={
                <Link href="/assessments" className={buttonClass('secondary', 'sm')}>
                    New assessment
                </Link>
            }
        >
            {assessments.length === 0 ? (
                <EmptyState
                    icon={<ClipboardCheck size={22} strokeWidth={1.5} />}
                    title="No assessments yet"
                    description="Take one and this fills up with your scores, levels and dates."
                    action={
                        <Link href="/assessments" className={buttonClass('primary', 'sm')}>
                            Take your first assessment
                        </Link>
                    }
                />
            ) : (
                <div className="space-y-4">
                    {open.length > 0 ? (
                        <div className="rounded-lg border border-[color:var(--streak)] bg-streak-soft px-4 py-3">
                            <p className="text-[0.8125rem] font-medium">
                                {open.length} assessment{open.length === 1 ? '' : 's'} still open
                            </p>
                            <ul className="mt-1.5 space-y-1">
                                {open.map((item) => (
                                    <li key={item.assessmentId} className="text-[0.8125rem]">
                                        <Link
                                            href={`/assessments/${item.assessmentId}`}
                                            className="text-[color:var(--accent-hover)] hover:underline"
                                        >
                                            Continue {item.categoryName}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    {finished.length > 0 ? (
                        <ul className="divide-y divide-border">
                            {finished.map((item) => (
                                <li
                                    key={item.assessmentId}
                                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                                >
                                    <div className="min-w-0">
                                        <Link
                                            href={`/assessments/${item.assessmentId}/results`}
                                            className="text-sm font-medium hover:underline"
                                        >
                                            {item.categoryName}
                                        </Link>
                                        <p className="mt-0.5 text-xs text-subtle-foreground">
                                            {formatDate(item.createdAt)}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {item.resultLevel ? (
                                            <Chip tone="muted">{LEVEL_LABELS[item.resultLevel]}</Chip>
                                        ) : null}
                                        <span className="w-14 text-right text-sm font-semibold tabular">
                                            {formatScore(item.score)}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            )}
        </Section>
    );
}
