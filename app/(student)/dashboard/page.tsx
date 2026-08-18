/**
 * Student dashboard.
 *
 * Layer: PAGE — calls progress.service, never a repository (§3.2)
 * Stories: SP-070, SP-071, SP-072, SP-073
 *
 * Sketch
 *  - per category: current level, latest score, plan items completed / total
 *  - overall completion percentage across all categories (SP-072)
 *  - brand-new student: <EmptyState> with "take your first assessment" —
 *    never a broken layout, never a crash on zero rows (SP-073)
 */

import React from 'react';
import { logoutAction } from '../../../lib/auth/current-user';

export default function DashboardPage() {
    return React.createElement(
        'main',
        { style: { maxWidth: '800px', margin: '2rem auto', fontFamily: 'sans-serif', padding: '1.5rem' } },
        React.createElement('h1', null, 'Student Dashboard'),
        React.createElement('p', null, 'Welcome to your SkillPath dashboard!'),
        React.createElement(
            'form',
            { action: logoutAction, style: { marginTop: '2rem' } },
            React.createElement(
                'button',
                { type: 'submit', style: { padding: '0.5rem 1rem', background: '#e53e3e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' } },
                'Log Out'
            )
        )
    );
}