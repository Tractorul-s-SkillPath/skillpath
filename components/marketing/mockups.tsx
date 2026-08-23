/**
 * Landing-page product mockups.
 *
 * Story: SP-012
 *
 * Static illustrations of screens that exist behind the login. They are built
 * from the same tokens as the real thing, so when the palette changes these
 * change with it and never drift into looking like a different product.
 *
 * Two rules for everything in this file:
 *
 * 1. Every mockup is `aria-hidden`. The content is fictional — a screen reader
 *    reading out "SQL 58%" as though it were the visitor's own score would be
 *    a lie. The surrounding section text carries the meaning instead, which is
 *    why each mockup is paired with a real paragraph.
 * 2. No data comes from the database. The landing page renders for people with
 *    no account, and it must not depend on a query that RLS would refuse.
 *
 * The question and answers are the real seeded React question
 * (scripts/seed.mjs), so the sample is not inventing a product we don't have.
 */

import * as React from 'react';
import { Check, Clock, Flame } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Shared shell: the card chrome every mockup sits in. */
function MockCard({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <div
            aria-hidden="true"
            className={cn(
                'rounded-[var(--radius-card)] border border-border bg-surface shadow-sm',
                className,
            )}
        >
            {children}
        </div>
    );
}

function MockHeader({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            {children}
        </div>
    );
}

/** A pill, styled like <Chip> but never interactive and never announced. */
function MockChip({
    tone = 'muted',
    className,
    children,
}: {
    tone?: 'muted' | 'accent' | 'warm' | 'success' | 'danger';
    className?: string;
    children: React.ReactNode;
}) {
    const TONES = {
        muted: 'border-border bg-surface-muted text-muted-foreground',
        accent: 'border-transparent bg-accent-soft text-[color:var(--accent-hover)]',
        warm: 'border-transparent bg-streak-soft text-[color:var(--streak)]',
        success: 'border-transparent bg-success-soft text-[color:var(--success)]',
        danger: 'border-transparent bg-danger-soft text-[color:var(--danger)]',
    } as const;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
                'text-xs font-medium leading-none',
                TONES[tone],
                className,
            )}
        >
            {children}
        </span>
    );
}

/** A track + fill, styled like <Progress> but without the ARIA role. */
function MockBar({ pct, tone = 'accent' }: { pct: number; tone?: 'accent' | 'warm' | 'success' | 'danger' }) {
    const TONES = {
        accent: 'bg-accent',
        warm: 'bg-streak',
        success: 'bg-success',
        danger: 'bg-danger',
    } as const;

    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div className={cn('h-full rounded-full', TONES[tone])} style={{ width: `${pct}%` }} />
        </div>
    );
}

// ---------------------------------------------------------------------------

const ANSWERS = [
    { text: 'To sort the list automatically', chosen: false },
    { text: 'To match elements across renders and preserve their state', chosen: true },
    { text: 'To make the list accessible', chosen: false },
    { text: 'To memoise each item', chosen: false },
];

/** Mid-assessment: one question, four options, a clock and a progress strip. */
export function AssessmentMock({ className }: { className?: string }) {
    return (
        <MockCard className={className}>
            <MockHeader>
                <div className="flex items-center gap-2">
                    <MockChip tone="accent">React</MockChip>
                    <span className="text-xs text-muted-foreground tabular">Question 3 of 10</span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground tabular">
                    <Clock size={13} strokeWidth={1.75} />
                    08:24
                </span>
            </MockHeader>

            <div className="px-4 py-4">
                <p className="text-sm font-medium leading-relaxed text-foreground">
                    Why does React need a stable key on list items?
                </p>

                <ul className="mt-4 space-y-2">
                    {ANSWERS.map((answer) => (
                        <li
                            key={answer.text}
                            className={cn(
                                'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[0.8125rem] leading-snug',
                                answer.chosen
                                    ? 'border-accent bg-accent-soft text-foreground'
                                    : 'border-border text-muted-foreground',
                            )}
                        >
                            <span
                                className={cn(
                                    'mt-px flex size-4 shrink-0 items-center justify-center rounded-full border',
                                    answer.chosen
                                        ? 'border-accent bg-accent text-accent-foreground'
                                        : 'border-border-strong',
                                )}
                            >
                                {answer.chosen ? <Check size={10} strokeWidth={3} /> : null}
                            </span>
                            {answer.text}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="border-t border-border px-4 py-3">
                <MockBar pct={30} />
            </div>
        </MockCard>
    );
}

// ---------------------------------------------------------------------------

const CATEGORIES = [
    { name: 'React', score: 72, tone: 'accent' as const, level: 'Intermediate' },
    { name: 'SQL', score: 58, tone: 'danger' as const, level: 'Weak area' },
    { name: 'Testing', score: 100, tone: 'success' as const, level: 'Advanced' },
];

/** After the assessment: the score, the level it implies, the weak area. */
export function ScoreMock({ className }: { className?: string }) {
    return (
        <MockCard className={className}>
            <MockHeader>
                <span className="text-[0.8125rem] font-semibold text-foreground">Your skills</span>
                <span className="text-xs text-muted-foreground">3 categories</span>
            </MockHeader>

            <div className="px-4 py-4">
                <div className="flex items-end gap-3">
                    <span className="text-4xl font-semibold leading-none tracking-tight text-foreground tabular">
                        77%
                    </span>
                    <span className="pb-1 text-xs text-muted-foreground">overall</span>
                </div>

                <div className="mt-5 space-y-3.5">
                    {CATEGORIES.map((category) => (
                        <div key={category.name}>
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                                <span className="text-[0.8125rem] font-medium text-foreground">
                                    {category.name}
                                </span>
                                <div className="flex items-center gap-2">
                                    <MockChip tone={category.tone === 'danger' ? 'danger' : 'muted'}>
                                        {category.level}
                                    </MockChip>
                                    <span className="w-9 text-right text-[0.8125rem] text-muted-foreground tabular">
                                        {category.score}%
                                    </span>
                                </div>
                            </div>
                            <MockBar pct={category.score} tone={category.tone} />
                        </div>
                    ))}
                </div>
            </div>
        </MockCard>
    );
}

// ---------------------------------------------------------------------------

const PLAN_ITEMS = [
    { text: 'Review INNER vs OUTER JOIN semantics', priority: 'High', done: true },
    { text: 'Practice index selection on a large table', priority: 'High', done: false },
    { text: 'Model a many-to-many relationship end to end', priority: 'Medium', done: false },
];

/** What a weak area turns into: ordered work, not a reading list. */
export function PlanMock({ className }: { className?: string }) {
    return (
        <MockCard className={className}>
            <MockHeader>
                <span className="text-[0.8125rem] font-semibold text-foreground">Learning plan</span>
                <MockChip tone="accent">SQL</MockChip>
            </MockHeader>

            <ul className="divide-y divide-border">
                {PLAN_ITEMS.map((item) => (
                    <li key={item.text} className="flex items-start gap-3 px-4 py-3">
                        <span
                            className={cn(
                                'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border',
                                item.done
                                    ? 'border-success bg-success text-[color:var(--surface)]'
                                    : 'border-border-strong',
                            )}
                        >
                            {item.done ? <Check size={11} strokeWidth={3} /> : null}
                        </span>

                        <span
                            className={cn(
                                'flex-1 text-[0.8125rem] leading-snug',
                                item.done
                                    ? 'text-subtle-foreground line-through'
                                    : 'text-foreground',
                            )}
                        >
                            {item.text}
                        </span>

                        <span className="shrink-0 text-xs text-muted-foreground">{item.priority}</span>
                    </li>
                ))}
            </ul>
        </MockCard>
    );
}

// ---------------------------------------------------------------------------

/** The effort side: XP toward the next level, and the streak. */
export function XpMock({ className }: { className?: string }) {
    return (
        <MockCard className={className}>
            <div className="px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[0.8125rem] font-semibold text-foreground">Level 4</p>
                        <p className="mt-0.5 text-xs text-muted-foreground tabular">
                            320 / 500 XP to level 5
                        </p>
                    </div>
                    <MockChip tone="warm">
                        <Flame size={12} strokeWidth={2} />6-day streak
                    </MockChip>
                </div>

                <div className="mt-3">
                    <MockBar pct={64} />
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-4">
                    <MockChip tone="success">
                        <Check size={12} strokeWidth={2.5} />
                        First assessment
                    </MockChip>
                    <MockChip tone="success">
                        <Check size={12} strokeWidth={2.5} />
                        Plan starter
                    </MockChip>
                    <MockChip>Perfect score</MockChip>
                </div>
            </div>
        </MockCard>
    );
}
