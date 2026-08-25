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

/**
 * Applies the stored theme before first paint.
 *
 * This has to be a blocking inline script in <head>. A component cannot help:
 * anything running in useEffect lands after the browser has already painted,
 * which is the white flash on a dark-theme page that every site with a theme
 * switch gets wrong at least once.
 *
 * Absence of the key means "follow the OS" — the media query in globals.css
 * already handles that, so the script adds no class at all in that case.
 * Wrapped in try/catch because localStorage throws outright in some privacy
 * modes, and a theme preference is not worth a blank page.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem('skillpath-theme');if(t==='dark'||t==='light'){document.documentElement.classList.add(t);document.documentElement.style.colorScheme=t}}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        // The theme script edits <html> before React hydrates, so the class
        // list legitimately differs from what the server sent.
        <html lang="en" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
            </head>
            <body className="bg-background text-foreground antialiased">
                {/* First tab stop on every page in the app. Every layout marks
                    its content region with id="main" to receive it. */}
                <a href="#main" className="skip-link">
                    Skip to content
                </a>
                {children}
            </body>
        </html>
    );
}
