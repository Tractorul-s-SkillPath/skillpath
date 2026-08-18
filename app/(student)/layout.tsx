/**
 * Student route-group layout.
 *
 * Layer: PAGE
 * Story: SP-012
 *
 * Sketch
 *  - assertAuth() -> redirect /login when absent
 *  - <SiteHeader /> with nav: Dashboard · Assessments · Plan · Profile
 *  - admins are allowed in here too; only /admin is role-restricted
 */

import React from 'react';

export default function StudentLayout({
                                          children,
                                      }: {
    children: React.ReactNode;
}) {
    return React.createElement(
        'div',
        { className: 'student-container' },
        children
    );
}