/**
 * Learning plan.
 *
 * Layer: PAGE — calls the service, never a repository (§3.2)
 * Stories: SP-062, SP-063, SP-064, SP-065
 *
 * The plan's own page — it used to render only as a section of the profile.
 * Grouped by category, most urgent first (the service returns priority order
 * and grouping preserves it). Each item carries its status control; the
 * rule-based text always renders, the AI elaboration only when a provider
 * produced one (SP-091 AC3).
 *
 * No plan yet is an invitation, not an apology: the one action that creates a
 * plan is finishing an assessment, so that is where the empty state points.
 */

import Link from 'next/link';
import { Route } from 'lucide-react';
import { assertAuth } from '../../../lib/auth/assertAuth';
import { getPlan } from '../../../lib/services/plan.service';
import { completionRate } from '../../../lib/domain/progress';
import { Section } from '../../../components/ui/card';
import { Progress } from '../../../components/ui/progress';
import { EmptyState } from '../../../components/empty-state';
import { buttonClass } from '../../../components/ui/button';
import { PlanItemCard } from './plan-item-card';
import type { PlanItem } from '../../../lib/domain/types';

export const metadata = { title: 'Your plan · SkillPath' };

// Per-member, and changes with every status click and every graded run.
export const dynamic = 'force-dynamic';

/** Priority order in, priority order out — insertion order IS the grouping. */
function groupByCategory(plan: PlanItem[]): Array<[string, PlanItem[]]> {
    const groups = new Map<string, PlanItem[]>();

    for (const item of plan) {
        const existing = groups.get(item.categoryName);
        if (existing) existing.push(item);
        else groups.set(item.categoryName, [item]);
    }

    return [...groups.entries()];
}

export default async function PlanPage() {
    const user = await assertAuth();

    const result = await getPlan(user.userId);

    // Unlike an empty plan, a failed read is not a state this page can render
    // honestly — let error.tsx say something went wrong.
    if (!result.ok) throw new Error('The learning plan could not be loaded.');

    const plan = result.value;
    const done = plan.filter((item) => item.status === 'completed').length;
    const percent = completionRate(plan);

    return (
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 lg:py-10">
            <header className="rise">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                    Your learning plan
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    The weak areas from your assessments, turned into things to do.
                </p>
            </header>

            <Section
                title="Learning plan"
                description="Generated from your weak areas. Highest priority first."
                action={
                    plan.length > 0 ? (
                        <span className="text-xs text-muted-foreground tabular">
                            {done} of {plan.length} done
                        </span>
                    ) : null
                }
                className="rise stagger-1"
            >
                {plan.length === 0 ? (
                    <EmptyState
                        icon={<Route size={22} strokeWidth={1.5} />}
                        title="No plan yet"
                        description="Finish an assessment and SkillPath builds one from whatever it finds you're weakest at."
                        action={
                            <Link href="/assessments" className={buttonClass('primary', 'sm')}>
                                Find an assessment
                            </Link>
                        }
                    />
                ) : (
                    <div className="space-y-6">
                        <Progress
                            value={done}
                            max={plan.length}
                            label="Plan completion"
                            tone={percent === 100 ? 'success' : 'accent'}
                        />

                        {groupByCategory(plan).map(([categoryName, items]) => (
                            <div key={categoryName}>
                                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
                                    {categoryName}
                                </h3>
                                <ul className="divide-y divide-border">
                                    {items.map((item) => (
                                        <PlanItemCard key={item.recommendationId} item={item} />
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </Section>
        </div>
    );
}
