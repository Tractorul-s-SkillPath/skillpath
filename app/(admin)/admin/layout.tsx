/**
 * Admin route-group layout.
 *
 * Layer: PAGE
 * Story: SP-012
 *
 * Sketch
 *  - assertAdmin() -> 403 for students
 *  - the redirect is convenience. Every query underneath ALSO fails on RLS /
 *    is_admin() if the guard were removed — that is SP-012 AC2 and it has a test.
 *  - admin nav: Overview · Categories · Questions · Results · Users
 */

import React from 'react';

export default function AdminLayout({
                                        children,
                                    }: {
    children: React.ReactNode;
}) {
    return React.createElement(
        'div',
        { className: 'admin-container' },
        children
    );
}