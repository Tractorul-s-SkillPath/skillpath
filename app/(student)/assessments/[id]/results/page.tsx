/**
 * Results page.
 *
 * Layer: PAGE
 * Stories: SP-053, SP-116, SP-117
 *
 * Score and level, the per-band breakdown, what to study next, and the full
 * review — in that order, because that is the order of usefulness. An
 * in-progress id bounces back into the run; somebody else's id, or none, is a
 * 404 that cannot be told apart from a missing one (SP-053 AC2).
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { assertAuth } from '../../../../../lib/auth/assertAuth';
import { getResults } from '../../../../../lib/services/grading.service';
import { GENERAL_KNOWLEDGE_CATEGORY_ID } from '../../../../../lib/domain/constants';
import { buttonClass } from '../../../../../components/ui/button';
import { Section } from '../../../../../components/ui/card';
import { Chip } from '../../../../../components/ui/chip';
import { ScoreSummary } from './score-summary';
import { ResponseReview } from './response-review';

export const metadata = { title: 'Results · SkillPath' };
export const dynamic = 'force-dynamic';

export default async function AssessmentResultsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const user = await assertAuth();

    const { id } = await params;
    const assessmentId = Number.parseInt(id, 10);
    if (!Number.isFinite(assessmentId)) notFound();

    const results = await getResults(user.userId, assessmentId);

    if (!results.ok) {
        // 'conflict' is the one informative failure: the run exists, is
        // theirs, and is not finished — the right place is back inside it.
        if (results.error.code === 'conflict') redirect(`/assessments/${assessmentId}`);
        notFound();
    }

    const { categoryId, categoryName, score, level, bands, review, recommendations } =
        results.value;

    // The baseline keeps its own headline: it is the one run that defines a
    // starting point rather than updating one.
    const isBaseline = categoryId === GENERAL_KNOWLEDGE_CATEGORY_ID;

    return (
        <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6 lg:py-10">
            <header className="rise">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                    {isBaseline ? 'Your baseline results' : `Your ${categoryName} results`}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    {isBaseline
                        ? 'This is your starting point — every assessment from here on is measured against it.'
                        : 'Your level and last score in this category are updated from this run.'}
                </p>
            </header>

            <div className="rise stagger-1">
                <ScoreSummary
                    score={score}
                    level={level}
                    levelCaption={isBaseline ? 'Starting level' : 'Your level'}
                    bands={bands}
                />
            </div>

            {recommendations.length > 0 && (
                <Section
                    title="What to focus on"
                    description="Built from the questions you missed — most fundamental first."
                    action={
                        <Link href="/plan" className={buttonClass('secondary', 'sm')}>
                            View your plan
                        </Link>
                    }
                    className="rise stagger-2"
                >
                    <ul className="space-y-3">
                        {recommendations.map((item) => (
                            <li
                                key={item.recommendationId}
                                className="rounded-lg border border-border px-4 py-3"
                            >
                                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                    <p className="text-sm font-medium text-foreground">
                                        {item.topicTitle}
                                    </p>
                                    <Chip tone={item.priority === 1 ? 'warm' : 'muted'}>
                                        Priority {item.priority}
                                    </Chip>
                                </div>
                                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
                                    {item.description}
                                </p>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            <Section
                title="Question review"
                description="What you picked and what was right, question by question."
                className="rise stagger-3"
            >
                <ResponseReview review={review} />
            </Section>

            <div className="rise stagger-4 flex justify-end">
                <Link href="/dashboard" className={buttonClass('primary')}>
                    Back to your dashboard
                </Link>
            </div>
        </div>
    );
}
