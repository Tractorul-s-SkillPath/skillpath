/**
 * "You are about to start an assessment" — the ask before the clock starts.
 *
 * Stories: SP-040, SP-042, SP-112
 *
 * Starting is not undoable in the way a click usually is: the run is created,
 * the timer starts from that moment, and for the baseline the single attempt
 * is spent. So every start goes through here first — the baseline's Begin on
 * this page and on the dashboard, and every category's Start.
 *
 * WHY THIS FILE EXISTS RATHER THAN THE PAGE CALLING ConfirmDialog DIRECTLY
 *
 * The confirm control is a LINK, and a link leaves the dialog open behind it
 * when it opens a new tab. ConfirmDialog hands `close` to a function slot for
 * exactly that case, and a function cannot be passed from a Server Component.
 * This client component is that boundary, and it takes only plain strings.
 *
 * The link is a plain <a>, not next/link: prefetch would fetch the front-door
 * route, and that route CREATES the run.
 */

'use client';

import { ConfirmDialog } from '../../../components/confirm-dialog';
import { buttonClass } from '../../../components/ui/button';
import {
    BASELINE_QUESTION_COUNT,
    BASELINE_TIME_LIMIT_SECONDS,
} from '../../../lib/domain/constants';

/**
 * The baseline's warning, once. Two pages offer it — this one and the
 * dashboard card — and the thing being warned about (one attempt) is exactly
 * the kind of sentence that goes stale on one of them if it is written twice.
 */
export const BASELINE_START_DESCRIPTION =
    `${BASELINE_QUESTION_COUNT} questions and ${Math.round(BASELINE_TIME_LIMIT_SECONDS / 60)} ` +
    'minutes, and you only take it once. The clock starts the moment the tab opens and submits ' +
    'for you when it runs out — so begin when you have the time.';

interface StartDialogProps {
    /** The front door: /assessments/baseline or /assessments/start/[id]. */
    href: string;
    /** What the assessment is called, in the dialog's question. */
    name: string;
    /** The trigger's label — "Begin" for the baseline, "Start" otherwise. */
    triggerLabel: string;
    /** The consequences, in one sentence: length, clock, retakes. */
    description: string;
    triggerVariant?: 'primary' | 'secondary';
    triggerSize?: 'sm' | 'md';
}

export function StartDialog({
    href,
    name,
    triggerLabel,
    description,
    triggerVariant = 'primary',
    triggerSize = 'sm',
}: StartDialogProps) {
    return (
        <ConfirmDialog
            triggerLabel={triggerLabel}
            triggerAriaLabel={`${triggerLabel} the ${name}`}
            triggerVariant={triggerVariant}
            triggerSize={triggerSize}
            title={`Start the ${name}?`}
            description={description}
            cancelLabel="Not yet"
            confirm={(close) => (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener"
                    onClick={close}
                    className={buttonClass('primary', 'sm')}
                >
                    Start in a new tab
                </a>
            )}
        />
    );
}
