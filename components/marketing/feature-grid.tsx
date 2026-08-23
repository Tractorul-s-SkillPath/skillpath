/**
 * Feature grid.
 *
 * Story: SP-012
 *
 * Six cards, each naming something the app genuinely does. The AI card says
 * "reviews every draft" on purpose — the architecture puts the AI features on
 * top of the rule-based core rather than in place of it, and the landing page
 * should not promise a machine deciding anybody's level.
 */

import { BarChart3, ClipboardCheck, Route, Sparkles, Target, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SectionHeading } from './section-heading';

const FEATURES: ReadonlyArray<{ icon: LucideIcon; title: string; body: string }> = [
    {
        icon: Target,
        title: 'A level you can defend',
        body: 'Beginner, intermediate and advanced come from score thresholds written down in one place — so the answer to "where did this come from" is always the same.',
    },
    {
        icon: ClipboardCheck,
        title: 'A question bank, not a quiz',
        body: 'Every question is tagged by category and difficulty, so an assessment is a fair spread across the skill instead of whatever came up first.',
    },
    {
        icon: TrendingUp,
        title: 'Weak areas, named',
        body: 'You do not just get a number. You get the specific categories pulling it down, ranked, with the responses that produced them.',
    },
    {
        icon: Route,
        title: 'A plan, not a reading list',
        body: 'Weak areas turn into prioritised items with a status you can move. What to do next is a line on a page, not a decision you have to make.',
    },
    {
        icon: BarChart3,
        title: 'Progress per category',
        body: 'Score history over time and completion per category, so a retake shows you the delta rather than replacing the last result.',
    },
    {
        icon: Sparkles,
        title: 'AI-assisted question authoring',
        body: 'Admins draft new questions with AI to keep the bank growing — and review every draft before it can reach anyone taking an assessment.',
    },
];

export function FeatureGrid() {
    return (
        <section
            id="features"
            aria-labelledby="features-title"
            className="scroll-mt-14 border-b border-border"
        >
            <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
                <SectionHeading
                    id="features-title"
                    eyebrow="What you get"
                    title="Assessment that ends in something to do"
                    description="Every part of SkillPath exists to answer one of two questions: where am I, and what next."
                />

                <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {FEATURES.map((feature) => (
                        <li
                            key={feature.title}
                            className="rounded-[var(--radius-card)] border border-border bg-surface p-5"
                        >
                            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-accent-soft text-[color:var(--accent-hover)]">
                                <feature.icon size={17} strokeWidth={1.75} aria-hidden="true" />
                            </span>

                            <h3 className="mt-4 text-[0.9375rem] font-semibold tracking-tight text-foreground">
                                {feature.title}
                            </h3>
                            <p className="mt-1.5 text-[0.875rem] leading-relaxed text-muted-foreground">
                                {feature.body}
                            </p>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
