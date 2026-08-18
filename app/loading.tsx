/**
 * Root loading UI (streaming fallback).
 *
 * Sketch: a skeleton, not a spinner. Route-level loading.tsx files override this.
 */

import React from 'react';

export default function Loading()
{
    return React.createElement('div', { style: { padding: '2rem', textAlign: 'center' } }, 'Se incarca...');
}