/**
 * The question bank for one category.
 *
 * Layer: PAGE
 * Stories: SP-033, SP-034
 *
 * This is the one screen in the app that shows `isCorrect`. Everything a
 * student can reach is served the same rows with that field removed
 * (ARCHITECTURE §5, "the is_correct problem"); the guard is assertAdmin() in
 * question.service, called before the read.
 *
 * `params` is a Promise in Next 16. A bad or unknown id is a 404, not a crash:
 * `parseInt('abc')` gives NaN, and the previous version passed that straight
 * into a query.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategory } from '../../../../../lib/services/category.service';
import { listQuestionsByCategory } from '../../../../../lib/services/question.service';
import { unwrapOr } from '../../../../../lib/result';
import { QuestionForm } from './question-form';
import { Section } from '../../../../../components/ui/card';
import { Chip } from '../../../../../components/ui/chip';
import { buttonClass } from '../../../../../components/ui/button';
import { EmptyState } from '../../../../../components/empty-state';

// Static rather than a generateMetadata that names the category: that would
// mean a second, uncached read of the same row just to fill in the tab title.
export const metadata = { title: 'Question bank · SkillPath admin' };

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

const DIFFICULTY_TONE = {
    beginner: 'success',
    intermediate: 'warm',
    advanced: 'danger',
} as const;

export default async function AdminCategoryQuestionsPage({ params }: { params: Params }) {
    const { id } = await params;
    const categoryId = Number(id);

    if (!Number.isInteger(categoryId) || categoryId <= 0) notFound();

    const categoryResult = await getCategory(categoryId);

    // Without the category there is no page — and a missing one is a 404 rather
    // than an empty heading over an empty list.
    if (!categoryResult.ok) notFound();

    const category = categoryResult.value;
    const questions = unwrapOr(await listQuestionsByCategory(categoryId), []);

    return (
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 lg:py-10">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">
                        {category.name}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {questions.length} {questions.length === 1 ? 'question' : 'questions'} in this
                        category.
                    </p>
                </div>

                <Link href="/admin/categories" className={buttonClass('ghost', 'sm')}>
                    ← Categories
                </Link>
            </header>

            <div className="grid gap-5 lg:grid-cols-[22rem_1fr] lg:items-start">
                <Section title="New question" description="Four options, exactly one of them correct.">
                    <QuestionForm categoryId={categoryId} />
                </Section>

                <Section title="Question bank" description="Newest first. The correct option is marked.">
                    {questions.length === 0 ? (
                        <EmptyState
                            title="No questions yet"
                            description="A category with no questions cannot be assessed. Add the first one with the form beside this list."
                        />
                    ) : (
                        <ul className="space-y-5">
                            {questions.map((question) => (
                                <li
                                    key={question.questionId}
                                    className="border-b border-border pb-5 last:border-0 last:pb-0"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
                                            {question.text}
                                        </p>

                                        <div className="flex shrink-0 gap-2">
                                            <Chip tone={DIFFICULTY_TONE[question.difficulty]}>
                                                {question.difficulty}
                                            </Chip>
                                            {question.status === 'inactive' ? (
                                                <Chip tone="muted">inactive</Chip>
                                            ) : null}
                                        </div>
                                    </div>

                                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                                        {question.answers.map((answer) => (
                                            <li
                                                key={answer.answerId}
                                                className={
                                                    answer.isCorrect
                                                        ? 'rounded-lg border border-transparent bg-success-soft px-3 py-2 text-[0.8125rem] text-[color:var(--success)]'
                                                        : 'rounded-lg border border-border bg-surface-muted px-3 py-2 text-[0.8125rem] text-muted-foreground'
                                                }
                                            >
                                                {/*
                                                  The tick is decoration; the
                                                  word beside it is what a
                                                  screen reader reads out, and
                                                  what survives the colour being
                                                  invisible to the reader.
                                                */}
                                                {answer.isCorrect ? (
                                                    <span className="mr-1.5 font-medium">
                                                        <span aria-hidden="true">✓ </span>Correct:
                                                    </span>
                                                ) : null}
                                                {answer.text}
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    )}
                </Section>
            </div>
        </div>
    );
}
