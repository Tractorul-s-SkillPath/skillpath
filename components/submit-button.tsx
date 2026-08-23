/**
 * SubmitButton — disables itself while its form is in flight.
 *
 * Story: SP-010
 *
 * useFormStatus reads the enclosing form's pending state, so this has to be a
 * child of the <form>, not the component that renders it. Double submits are a
 * real bug here: two clicks on "Complete" would try to award XP twice (the
 * unique index in 0003 catches it, but the member should not see the flicker).
 */

'use client';

import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from './ui/button';

interface SubmitButtonProps extends Omit<ButtonProps, 'type'> {
    pendingLabel?: string;
}

export function SubmitButton({ children, pendingLabel, disabled, ...props }: SubmitButtonProps) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
            {pending && pendingLabel ? pendingLabel : children}
        </Button>
    );
}

export default SubmitButton;
