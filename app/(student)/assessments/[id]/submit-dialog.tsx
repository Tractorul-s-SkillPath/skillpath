/**
 * The submit control — asks once before it commits (SP-046 AC1).
 *
 * Not a modal: an inline confirm that names the unanswered count and offers
 * the way back. With everything answered the question would be noise, so it
 * submits straight away.
 */

'use client';

import * as React from 'react';
import { Button } from '../../../../components/ui/button';

interface SubmitDialogProps {
    unansweredCount: number;
    pending: boolean;
    onSubmit: () => void;
}

export function SubmitDialog({ unansweredCount, pending, onSubmit }: SubmitDialogProps) {
    const [confirming, setConfirming] = React.useState(false);

    if (pending) {
        return (
            <Button variant="primary" disabled aria-busy>
                Submitting…
            </Button>
        );
    }

    if (unansweredCount === 0 || confirming) {
        return (
            <div className="flex flex-wrap items-center justify-end gap-3">
                {confirming && (
                    <>
                        <p className="text-sm text-muted-foreground" role="alert">
                            {unansweredCount === 1
                                ? '1 question is unanswered and will count as incorrect.'
                                : `${unansweredCount} questions are unanswered and will count as incorrect.`}
                        </p>
                        <Button onClick={() => setConfirming(false)}>Keep answering</Button>
                    </>
                )}
                <Button variant="primary" onClick={onSubmit}>
                    {confirming ? 'Submit anyway' : 'Submit assessment'}
                </Button>
            </div>
        );
    }

    return (
        <Button variant="primary" onClick={() => setConfirming(true)}>
            Submit assessment
        </Button>
    );
}
