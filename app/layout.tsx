/**
 * Root layout.
 *
 * Layer: PAGE — fetch + render only (§3)
 * Story: SP-001
 *
 * Sketch
 *  - <html lang="en">, font, globals.css, <body> + children
 *  - no session read here; each route group decides its own guard
 */

import React from 'react';
import './globals.css';

export const metadata = {
    title: 'SkillPath',
    description: 'Platforma de invatare SkillPath',
};

export default function RootLayout(props: { children: React.ReactNode })
{
    return React.createElement(
        'html',
        { lang: 'en' },
        React.createElement('body', null, props.children)
    );
}