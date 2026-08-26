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
import QuestionForm from './question-form';
import EditQuestionForm from './edit-question-form';
import { StatusToggle } from '../../status-toggle';
import { Section } from '../../../../../components/ui/card';
import { Chip } from '../../../../../components/ui/chip';
import { buttonClass } from '../../../../../components/ui/button';
import { EmptyState } from '../../../../../components/empty-state';
import { setQuestionStatusAction } from './actions';

// Static rather than a generateMetadata that names the category: that would
// mean a second, uncached read of the same row just to fill in the tab title.
export const metadata = { title: 'Question bank · SkillPath admin' };

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ edit?: string }>;

const DIFFICULTY_TONE = {
    beginner: 'success',
    intermediate: 'warm',
    advanced: 'danger',
} as const;

export default async function AdminCategoryQuestionsPage({
    params,
    searchParams
}: {
    params: Params,
    searchParams: SearchParams
}) {
    const { id } = await params;
    const categoryId = Number(id);

    // Citim parametrul de editare din URL
    const search = await searchParams;
    const editingId = search.edit ? Number(search.edit) : null;

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
                <Section
                    title="New question"
                    description="Two to six options, at least one of them correct."
                >
                    <QuestionForm categoryId={categoryId} />
                </Section>

                <Section title="Question bank" description="Newest first. Correct options are marked.">
                    {questions.length === 0 ? (
                        <EmptyState
                            title="No questions yet"
                            description="A category with no questions cannot be assessed. Add the first one with the form beside this list."
                        />
                    ) : (
                        <ul className="space-y-5">
                            {questions.map((question) => {
                                // DACĂ SUNTEM ÎN MODUL EDITARE PENTRU ACEASTĂ ÎNTREBARE
                                if (editingId === question.questionId) {
                                    return (
                                        <li key={`edit-${question.questionId}`} className="border-b border-border pb-5 last:border-0 last:pb-0">
                                            <EditQuestionForm question={question} categoryId={categoryId} />
                                        </li>
                                    );
                                }

                                // ALTFEL, AFIȘĂM ÎNTREBAREA NORMALĂ
                                return (
                                    <li
                                        key={question.questionId}
                                        className="border-b border-border pb-5 last:border-0 last:pb-0"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
                                                {question.text}
                                            </p>

                                            <div className="flex shrink-0 items-center gap-4">
                                                <div className="flex gap-2">
                                                    <Chip tone={DIFFICULTY_TONE[question.difficulty]}>
                                                        {question.difficulty}
                                                    </Chip>
                                                    {question.status === 'inactive' ? (
                                                        <Chip tone="muted">inactive</Chip>
                                                    ) : null}
                                                </div>

                                                <div className="flex items-start gap-2 border-l border-border pl-3">
                                                    <Link
                                                        href={`/admin/categories/${categoryId}?edit=${question.questionId}`}
                                                        className={buttonClass('secondary', 'sm')}
                                                    >
                                                        Edit
                                                    </Link>

                                                    {/*
                                                      The same toggle the users and categories tables
                                                      use. It posts the status it WANTS rather than a
                                                      flip of the one it can see, and it renders a
                                                      refusal instead of discarding it — the previous
                                                      bound-argument form did neither.
                                                    */}
                                                    <StatusToggle
                                                        action={setQuestionStatusAction}
                                                        fields={{
                                                            questionId: question.questionId,
                                                            categoryId,
                                                        }}
                                                        target={
                                                            question.status === 'active'
                                                                ? 'inactive'
                                                                : 'active'
                                                        }
                                                        label={
                                                            question.status === 'active'
                                                                ? 'Deactivate'
                                                                : 'Activate'
                                                        }
                                                        describedAs={question.text}
                                                    />
                                                </div>
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
                                );
                            })}
                        </ul>
                    )}
                </Section>
            </div>
        </div>
    );
}