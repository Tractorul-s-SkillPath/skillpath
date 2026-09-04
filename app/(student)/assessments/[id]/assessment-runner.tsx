/**
 * Assessment runner — client component. The one genuinely stateful screen.
 *
 * Stories: SP-043, SP-044, SP-045, SP-046, SP-113
 *
 * ONE PAGE, ALL TWENTY. No step wizard: every question is on screen, the
 * member answers in any order, and the sticky bar keeps the clock and the
 * count in view. Fewer moving parts, and a refresh has no "which step was I
 * on" to lose.
 *
 * The selection state here is a MIRROR, not a store. Every click calls
 * saveAnswerAction immediately — optimistic locally, reverted if the server
 * says no — so nothing lives only in React state and NOTHING in localStorage
 * (SP-044 AC2). The server is the session; this component is its display.
 *
 * Submission funnels through one guarded function shared by the button and the
 * timer's expiry, so a click racing the clock cannot submit twice from this
 * tab — and if the other side of a race wins elsewhere, the action answers
 * with a redirect to the results either way.
 */

'use client';

import * as React from 'react';
import type { RunQuestion } from '../../../../lib/domain/types';
import { saveAnswerAction, submitAssessmentAction } from './actions';
import { CountdownTimer } from './countdown-timer';
import { QuestionCard } from './question-card';
import { SubmitDialog } from './submit-dialog';
import { Progress } from '../../../../components/ui/progress';

interface AssessmentRunnerProps {
    assessmentId: number;
    /** The headline — "Baseline assessment" or "<category> assessment". */
    title: string;
    questions: RunQuestion[];
    initialRemainingSeconds: number;
}

export function AssessmentRunner({
    assessmentId,
    title,
    questions,
    initialRemainingSeconds,
}: AssessmentRunnerProps) {
    const [selections, setSelections] = React.useState<Record<number, number | null>>(() =>
        Object.fromEntries(questions.map((q) => [q.questionId, q.selectedAnswerId])),
    );
    const [error, setError] = React.useState<string | null>(null);
    const [submitting, setSubmitting] = React.useState(false);
    const submittedRef = React.useRef(false);

    const answered = Object.values(selections).filter((v) => v !== null).length;

    const select = (questionId: number, answerId: number) => {
        const previous = selections[questionId] ?? null;
        setSelections((current) => ({ ...current, [questionId]: answerId }));
        setError(null);

        void saveAnswerAction(assessmentId, questionId, answerId).then((result) => {
            if (!result.ok) {
                setSelections((current) => ({ ...current, [questionId]: previous }));
                setError(result.message ?? 'That answer could not be saved.');
            }
        });
    };

    const submit = React.useCallback(() => {
        if (submittedRef.current) return;
        submittedRef.current = true;
        setSubmitting(true);

        void submitAssessmentAction(assessmentId).then((result) => {
            // On success the action redirects and never resolves this branch.
            if (result && !result.ok) {
                submittedRef.current = false;
                setSubmitting(false);
                setError(result.message ?? 'The assessment could not be submitted.');
            }
        });
    }, [assessmentId]);

    return (
        <div className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
            {/* The bar that never scrolls away: the clock and the count. */}
            <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
                <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground tabular">
                        <span className="font-medium text-foreground">{answered}</span> of{' '}
                        {questions.length} answered
                    </p>
                    <CountdownTimer
                        initialRemainingSeconds={initialRemainingSeconds}
                        onExpire={submit}
                    />
                </div>
                <Progress
                    value={answered}
                    max={questions.length}
                    label="Questions answered"
                    className="mt-2"
                />
            </div>

            <header className="mt-6">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Answer in any order — every answer is saved the moment you pick it. Unanswered
                    questions count as incorrect, and the clock submits for you when it runs out.
                </p>
            </header>

            {error && (
                <p
                    role="alert"
                    className="mt-4 rounded-lg border border-border bg-danger-soft px-4 py-3 text-sm text-danger"
                >
                    {error}
                </p>
            )}

            <div className="mt-6 space-y-4">
                {questions.map((question) => (
                    <QuestionCard
                        key={question.questionId}
                        question={question}
                        selectedAnswerId={selections[question.questionId] ?? null}
                        onSelect={(answerId) => select(question.questionId, answerId)}
                        disabled={submitting}
                    />
                ))}
            </div>

            <div className="mt-8 flex justify-end border-t border-border pt-6">
                <SubmitDialog
                    unansweredCount={questions.length - answered}
                    pending={submitting}
                    onSubmit={submit}
                />
            </div>
        </div>
    );
}
