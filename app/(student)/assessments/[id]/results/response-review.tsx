/**
 * Per-question review — your answer, the right one, after submission only.
 *
 * Story: SP-053
 *
 * Server component, no interactivity: the page guarantees status='submitted'
 * before this renders, which is what makes showing the key legitimate here and
 * nowhere else student-facing.
 */

import type { ReviewItem } from '../../../../../lib/domain/types';
import { Chip } from '../../../../../components/ui/chip';
import { cn } from '../../../../../lib/utils';

export function ResponseReview({ review }: { review: ReviewItem[] }) {
    return (
        <ol className="space-y-4">
            {review.map((item) => (
                <li
                    key={item.position}
                    className="rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:p-5"
                >
                    <div className="flex items-start justify-between gap-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground tabular">
                            Question {item.position}
                        </p>
                        <Chip tone={item.isCorrect ? 'success' : 'muted'}>
                            {item.isCorrect ? 'Correct' : item.selectedAnswerId === null ? 'Unanswered' : 'Incorrect'}
                        </Chip>
                    </div>

                    <p className="mt-2 text-sm font-medium leading-relaxed text-foreground">
                        {item.text}
                    </p>

                    <ul className="mt-3 space-y-1.5">
                        {item.options.map((option) => {
                            const isKey = option.answerId === item.correctAnswerId;
                            const isPick = option.answerId === item.selectedAnswerId;
                            // Only the rows that carry information get color:
                            // the right answer, and a wrong pick.
                            const wrongPick = isPick && !isKey;

                            return (
                                <li
                                    key={option.answerId}
                                    className={cn(
                                        'flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2 text-sm',
                                        isKey
                                            ? 'border-success bg-success-soft text-foreground'
                                            : wrongPick
                                              ? 'border-danger bg-danger-soft text-foreground'
                                              : 'border-border text-muted-foreground',
                                    )}
                                >
                                    <span>{option.text}</span>
                                    <span className="shrink-0 text-xs text-subtle-foreground">
                                        {isPick ? 'Your answer' : isKey ? 'Correct answer' : null}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </li>
            ))}
        </ol>
    );
}
