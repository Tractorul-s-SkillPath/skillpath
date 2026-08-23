/**
 * Progress section — effort and evidence, counted separately.
 *
 * Story: SP-012
 *
 * This is the one idea in SkillPath worth arguing for on a landing page, so it
 * gets a section instead of a card in the grid: XP is what you did, skill level
 * is what you proved, and no amount of the first moves the second.
 *
 * The XP numbers match lib/domain/constants.ts (50 per assessment, a point per
 * percent, 40 per plan item). They are prose here for the same reason as the
 * 60% in how-it-works — copy about the product, not a computation.
 */

import { Flame, ShieldCheck, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SectionHeading } from './section-heading';
import { XpMock } from './mockups';

const POINTS: ReadonlyArray<{ icon: LucideIcon; title: string; body: string }> = [
    {
        icon: Zap,
        title: 'XP is effort',
        body: 'Fifty for finishing an assessment, a point for every percent you scored, forty for each plan item you complete. Showing up counts.',
    },
    {
        icon: Flame,
        title: 'Streaks are consistency',
        body: 'Consecutive days of activity, tracked and visible from every page — because a plan worked at once and then abandoned is not progress.',
    },
    {
        icon: ShieldCheck,
        title: 'Skill level is evidence',
        body: 'It only changes when an assessment says so. You cannot grind your way to advanced, and that is what makes the badge worth having.',
    },
];

export function ProgressPreview() {
    return (
        <section
            id="progress"
            aria-labelledby="progress-title"
            className="scroll-mt-14 border-b border-border bg-surface-muted"
        >
            <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
                <SectionHeading
                    id="progress-title"
                    eyebrow="Staying with it"
                    title="Effort and evidence, counted separately"
                    description="Most learning apps blur the two, so a long streak starts to look like competence. SkillPath keeps them apart on purpose."
                />

                <div className="mt-12 grid items-center gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
                    <XpMock className="order-2 lg:order-1" />

                    <ul className="order-1 space-y-7 lg:order-2">
                        {POINTS.map((point) => (
                            <li key={point.title} className="flex gap-4">
                                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-[color:var(--accent-hover)]">
                                    <point.icon size={17} strokeWidth={1.75} aria-hidden="true" />
                                </span>

                                <div className="min-w-0">
                                    <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                                        {point.title}
                                    </h3>
                                    <p className="mt-1.5 text-[0.875rem] leading-relaxed text-muted-foreground">
                                        {point.body}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    );
}
