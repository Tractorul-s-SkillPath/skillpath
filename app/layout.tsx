/**
 * Root layout.
 *
 * Layer: PAGE — fetch + render only (§3)
 * Story: SP-001
 *
 * No session read here; each route group decides its own guard.
 *
 * This was written with React.createElement rather than JSX, along with the
 * auth pages and the three error boundaries. That is why the sign-in screen
 * used to look like a different product from the one behind it: createElement
 * makes the design system awkward enough to reach for that those files reached
 * for inline hex colours instead.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
    title: {
        default: 'SkillPath',
        template: '%s · SkillPath',
    },
    description: 'Assess a skill, find the gaps, work the plan.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body className="bg-background text-foreground antialiased">{children}</body>
        </html>
    );
}
