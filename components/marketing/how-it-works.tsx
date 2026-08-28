/**
 * How it works — the four steps, with the last two shown.
 *
 * Story: SP-012
 *
 * The steps are the actual flow (assessments → assessments/[id] →
 * results → plan), not a marketing simplification of it. The two mockups sit
 * beside steps 3 and 4 because "weak areas" and "a prioritised plan" are the
 * two claims a visitor is least likely to believe from text alone.
 *
 * The 60% figure is WEAK_AREA_THRESHOLD (lib/domain/constants.ts). It is
 * repeated as prose rather than imported: this is copy about the product, and
 * a landing page importing a business constant to render a sentence is a
 * dependency nobody wants to explain later. If the threshold moves, this
 * sentence is on the checklist.
 */

import { ScoreMock, PlanMock } from './mockups';
import { SectionHeading } from './section-heading';

const STEPS = [
    {
        title: 'Pick a category and a target level',
        body: 'Choose what you want to be assessed on and how far you are aiming — beginner, intermediate or advanced.',
    },
    {
        title: 'Take a timed assessment',
        body: 'Multiple-choice questions drawn from the bank across all three difficulties. One sitting, with the clock visible.',
    },
    {
        title: 'See your score and your weak areas',
        body: 'You get a percentage, the skill level it implies, and every category under 60% flagged as a weak area — with the answers behind it.',
    },
    {
        title: 'Work through the plan it generates',
        body: 'Each weak area becomes prioritised plan items. Tick them off, re-assess, and the level moves on evidence rather than on effort.',
    },
];

export function HowItWorks() {
    return (
        <section
            id="how-it-works"
            aria-labelledby="how-it-works-title"
            className="scroll-mt-14 border-b border-border bg-surface-muted"
        >
            <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
                <SectionHeading
                    id="how-it-works-title"
                    eyebrow="How it works"
                    title="Four steps, and you are looking at a plan"
                    description="No setup, no course to enrol in. The first assessment is the onboarding."
                />

                <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-14">
                    <ol className="space-y-8">
                        {STEPS.map((step, index) => (
                            <li key={step.title} className="flex gap-4">
                                <span
                                    aria-hidden="true"
                                    className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-[0.8125rem] font-semibold text-[color:var(--accent-hover)] tabular"
                                >
                                    {index + 1}
                                </span>

                                <div className="min-w-0 pt-1">
                                    <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                                        {step.title}
                                    </h3>
                                    <p className="mt-1.5 text-[0.875rem] leading-relaxed text-muted-foreground">
                                        {step.body}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>

                    <div className="space-y-4">
                        <ScoreMock />
                        <PlanMock />
                    </div>
                </div>
            </div>
        </section>
    );
}
