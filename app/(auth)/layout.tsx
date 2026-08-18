/**
 * Auth route-group layout.
 *
 * Layer: PAGE
 * Stories: SP-010, SP-011
 *
 * Sketch
 *  - centred card shell, no app nav
 *  - already authenticated -> redirect to the role's home
 */

import React from 'react';

export default function AuthLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return React.createElement(
        'div',
        { className: 'auth-container' },
        children
    );
}