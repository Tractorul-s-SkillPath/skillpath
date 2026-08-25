/**
 * Student dashboard.
 *
 * Layer: PAGE — calls a service, never a repository (§3.2)
 * Stories: SP-070, SP-071, SP-072, SP-073
 *
 * This was a <ComingSoon> placeholder, which is a defensible thing for a
 * scaffold to be — except that this is the page every student lands on the
 * instant they sign in, so the first impression of the product was a dashed
 * box explaining that the product was not written yet.
 *
 * WHERE THE DATA COMES FROM
 *
 * `getProfileDashboard` already returns everything this screen needs —
 * interests carry the per-category level and latest score, the plan carries
 * per-item status, and XP/streak come off the ledger. So this adds no queries
 * and invents no numbers; progress.service.ts stays a sketch because nothing
 * here needs a shape it does not already have. The one thing not shown is the
 * per-category score trend (SP-071), which genuinely does need a new query.
 *
 * SP-073: a brand-new member has no interests and no plan. Every block below
 * either renders an empty state that names the next action, or does not render
 * at all — none of them branch on undefined, because the service returns a
 * well-formed empty shape rather than nulls.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { assertAuth } from '../../../lib/auth/assertAuth';
import { getProfileDashboard, today } from '../../../lib/services/profile.service';
import { completionRate, overallCompletion } from '../../../lib/domain/progress';
import { standingFromXp, describeStreak } from '../../../lib/domain/gamification';
import { levelLabel } from '../../../lib/domain/levels';
import { Section } from '../../../components/ui/card';
import { Chip } from '../../../components/ui/chip';
import { Progress } from '../../../components/ui/progress';
import { EmptyState } from '../../../components/empty-state';
import { buttonClass } from '../../../components/ui/button';
import { formatScore, formatDate, fullName } from '../../../lib/utils';

export const metadata = { title: 'Dashboard · SkillPath' };

// Per-member, and changes every time they finish anything.
export const dynamic = 'force-dynamic';

/** Level -> Chip tone. Advanced is the only one that earns the success tone. */
function levelTone(level: string): 'success' | 'warm' | 'muted' {
    if (level === 'advanced') return 'success';
    if (level === 'intermediate') return 'warm';
    return 'muted';
}

export default async function DashboardPage() {
    const user = await assertAuth();
    const result = await getProfileDashboard(user.userId);

    // Same rule as the profile: without the member's own row there is no page.
    if (!result.ok) notFound();

    const { profile, interests, plan, assessments, xp, streak, lastActiveOn } = result.value;

    const standing = standingFromXp(xp);
    const streakCopy = describeStreak(streak, lastActiveOn, today());

    // One pass over the plan per category. `interests` is the member's own
    // followed categories, so this is at most a handful of rows either way.
    const categories = interests.map((interest) => {
        const items = plan.filter((item) => item.categoryId === interest.categoryId);

        return {
            interest,
            items,
            completed: items.filter((item) => item.status === 'completed').length,
            percent: completionRate(items),
        };
    });

    const overall = overallCompletion(
        categories.map((c) => ({ completed: c.completed, total: c.items.length })),
    );

    const submitted = assessments.filter((a) => a.status === 'submitted');

    return (
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 lg:py-10">
            <header className="rise">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                    {/* First name only. "Welcome back, Ana Maria Popescu" reads
                        like a letter from a bank. */}
                    Welcome back, {profile.firstName || fullName(profile.firstName, profile.lastName)}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Where you stand in every category you follow, in one screen.
                </p>
            </header>

            {/* Four numbers that answer "how am I doing" without scrolling. */}
            <dl className="rise stagger-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: 'Categories', value: String(interests.length) },
                    { label: 'Assessments', value: String(submitted.length) },
                    { label: 'Plan complete', value: `${overall}%` },
                    { label: 'Level', value: String(standing.level) },
                ].map((tile) => (
                    <div
                        key={tile.label}
                        className="interactive rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3 hover:border-border-strong"
                    >
                        <dt className="text-xs uppercase tracking-wide text-subtle-foreground">
                            {tile.label}
                        </dt>
                        <dd className="mt-1 text-2xl font-semibold tabular text-foreground">
                            {tile.value}
                        </dd>
                    </div>
                ))}
            </dl>

            <Section
                title="Your progress"
                description="XP comes from finishing assessments and plan items."
                className="rise stagger-2"
            >
                <div className="space-y-4">
                    <div>
                        <div className="flex items-baseline justify-between gap-4">
                            <p className="text-[0.8125rem] font-medium text-foreground">
                                Level {standing.level}
                            </p>
                            <p className="text-xs text-muted-foreground tabular">
                                {standing.into} / {standing.span} XP
                            </p>
                        </div>
                        <Progress
                            value={standing.into}
                            max={standing.span}
                            label={`Level ${standing.level} progress`}
                            className="mt-2"
                        />
                        <p className="mt-1.5 text-xs text-subtle-foreground tabular">
                            {standing.remaining} XP to level {standing.level + 1}
                        </p>
                    </div>

                    <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
                        <p className="text-[0.8125rem] text-muted-foreground">Streak</p>
                        <Chip tone={streakCopy.atRisk ? 'warm' : 'muted'}>
                            {streakCopy.headline}
                        </Chip>
                    </div>
                </div>
            </Section>

            <Section
                title="Categories"
                description="Your level, your latest score, and how much of the plan is done."
                action={
                    <Link href="/assessments/new" className={buttonClass('secondary', 'sm')}>
                        New assessment
                    </Link>
                }
                className="rise stagger-3"
            >
                {categories.length === 0 ? (
                    <EmptyState
                        title="No categories yet"
                        description="Pick the skills you want to be assessed on, then take your first assessment — everything on this page fills in from there."
                        action={
                            <Link href="/profile" className={buttonClass('primary', 'sm')}>
                                Choose your categories
                            </Link>
                        }
                    />
                ) : (
                    <ul className="space-y-3">
                        {categories.map(({ interest, items, completed, percent }, index) => (
                            <li
                                key={interest.categoryId}
                                className={`interactive rise stagger-${Math.min(index + 1, 6)} rounded-lg border border-border px-4 py-3 hover:border-border-strong hover:bg-surface-muted`}
                            >
                                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                    <p className="text-sm font-medium text-foreground">
                                        {interest.name}
                                    </p>

                                    <div className="flex items-center gap-2">
                                        <Chip tone={levelTone(interest.level)}>
                                            {levelLabel(interest.level)}
                                        </Chip>

                                        {/* A member who has never been assessed
                                            in this category has no score, and
                                            "0%" would be a different claim. */}
                                        <span className="text-[0.8125rem] text-muted-foreground tabular">
                                            {interest.lastScore === null
                                                ? 'Not assessed'
                                                : formatScore(interest.lastScore)}
                                        </span>
                                    </div>
                                </div>

                                {items.length > 0 ? (
                                    <div className="mt-2.5">
                                        <Progress
                                            value={completed}
                                            max={items.length}
                                            label={`${interest.name} plan progress`}
                                            tone={percent === 100 ? 'success' : 'accent'}
                                        />
                                        <p className="mt-1.5 text-xs text-subtle-foreground tabular">
                                            {completed} of {items.length} plan items done
                                            {interest.assessedAt
                                                ? ` · assessed ${formatDate(interest.assessedAt)}`
                                                : null}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="mt-2 text-xs text-subtle-foreground">
                                        No plan items yet — take an assessment to generate one.
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Section>
        </div>
    );
}
