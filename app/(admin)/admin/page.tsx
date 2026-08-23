/**
 * Admin overview.
 *
 * Layer: PAGE
 * Stories: SP-080, SP-081
 *
 * Sketch
 *  - tiles: total users, assessments completed, average score, most common
 *    weak category
 *  - the weak-category ranking is ONE SQL aggregate (stats.repo.ts). Pulling
 *    every row into JS to count is the failure mode SP-081 exists to prevent.
 */

import React from 'react';
import { logoutAction } from '../../../lib/auth/current-user';

export default function AdminDashboardPage() {
    return React.createElement(
        'main',
        { style: { maxWidth: '800px', margin: '2rem auto', fontFamily: 'sans-serif', padding: '1.5rem' } },
        React.createElement('h1', null, 'Admin Dashboard'),
        React.createElement('p', null, 'Welcome to the SkillPath administration panel!'),
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