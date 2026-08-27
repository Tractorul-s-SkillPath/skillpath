/**
 * Countdown — client component. Display plus one trigger, nothing more.
 *
 * Stories: SP-045, SP-114
 *
 * The deadline is fixed ONCE, from the seconds the server measured, and ticking
 * is Date.now() against that fixed point — an interval that counts down by
 * subtraction drifts whenever a background tab throttles its timers, and this
 * doesn't. On expiry it fires onExpire exactly once; the ref is the guard,
 * because an interval and a re-render can race a state flag.
 *
 * Freezing or patching this component gains nothing: the server recomputes
 * elapsed time from started_at on every save and on submit (SP-045 AC2).
 */

'use client';

import * as React from 'react';
import { formatClock } from '../../../../lib/domain/timer';
import { cn } from '../../../../lib/utils';

interface CountdownTimerProps {
    initialRemainingSeconds: number;
    onExpire: () => void;
}

export function CountdownTimer({ initialRemainingSeconds, onExpire }: CountdownTimerProps) {
    const [deadline] = React.useState(() => Date.now() + initialRemainingSeconds * 1000);
    const [remaining, setRemaining] = React.useState(initialRemainingSeconds);
    const firedRef = React.useRef(false);

    React.useEffect(() => {
        const tick = () => {
            const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            setRemaining(left);

            if (left <= 0 && !firedRef.current) {
                firedRef.current = true;
                onExpire();
            }
        };

        tick();
        const interval = window.setInterval(tick, 1000);
        return () => window.clearInterval(interval);
    }, [deadline, onExpire]);

    const urgent = remaining <= 60;

    return (
        <p
            // A timer that talks every second is unbearable in a screen reader;
            // 'off' keeps it visual, and the auto-submit speaks for itself.
            aria-live="off"
            className={cn(
                'text-sm font-semibold tabular',
                urgent ? 'text-danger' : 'text-foreground',
            )}
        >
            {formatClock(remaining)}
            <span className="ml-1.5 text-xs font-normal text-subtle-foreground">left</span>
        </p>
    );
}
