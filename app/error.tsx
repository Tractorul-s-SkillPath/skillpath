'use client'
/**
 * Global error boundary.
 *
 * Layer: PAGE (client component — error boundaries must be)
 * Story: SP-001 · convention §8: services return Result, only *unexpected*
 * throws reach this file.
 *
 * Sketch
 *  - generic message, a reset() button, digest logged
 *  - never renders error.message to the user: it can carry database detail
 */

import React from 'react';

export default function Error({
                                  error,
                                  reset,
                              }: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return React.createElement(
        'div',
        { style: { padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' } },
        React.createElement('h2', null, 'Ceva nu a functionat corect!'),
        React.createElement(
            'button',
            { onClick: () => reset(), style: { padding: '0.5rem 1rem', marginTop: '1rem', cursor: 'pointer' } },
            'Incearca din nou'
        )
    );
}