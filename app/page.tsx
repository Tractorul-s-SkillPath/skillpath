/**
 * Landing / entry point.
 *
 * Layer: PAGE
 * Story: SP-012
 *
 * Sketch
 *  - anonymous -> short marketing blurb + links to /login and /register
 *  - student   -> redirect /dashboard
 *  - admin     -> redirect /admin
 */

import React from 'react';
import { getCurrentUser, loginAction, logoutAction } from '../lib/auth/current-user';

export default async function HomePage() {
    const user = await getCurrentUser();

    if (user) {
        return React.createElement(
            'main',
            { style: { maxWidth: '400px', margin: '4rem auto', fontFamily: 'sans-serif', padding: '1.5rem', border: '1px solid #ccc', borderRadius: '8px' } },
            React.createElement('h2', null, 'SkillPath Authentication'),
            React.createElement('p', { style: { color: 'green', fontWeight: 'bold' } }, '✓ Successfully logged in!'),
            React.createElement(
                'div',
                { style: { marginBottom: '1rem' } },
                React.createElement('p', null, `Email: ${user.email}`),
                React.createElement('p', null, `Role: ${user.role}`),
                React.createElement('p', null, `Status: ${user.status}`)
            ),
            React.createElement(
                'form',
                { action: logoutAction },
                React.createElement(
                    'button',
                    { type: 'submit', style: { width: '100%', padding: '0.6rem', background: '#e53e3e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' } },
                    'Log Out'
                )
            )
        );
    }

    return React.createElement(
        'main',
        { style: { maxWidth: '400px', margin: '4rem auto', fontFamily: 'sans-serif', padding: '1.5rem', border: '1px solid #ccc', borderRadius: '8px' } },
        React.createElement('h2', null, 'SkillPath Authentication'),
        React.createElement(
            'form',
            { action: loginAction, style: { display: 'flex', flexDirection: 'column', gap: '1rem' } },
            React.createElement(
                'div',
                null,
                React.createElement('label', { style: { display: 'block', marginBottom: '0.25rem' } }, 'Email:'),
                React.createElement('input', {
                    type: 'email',
                    name: 'email',
                    placeholder: 'e.g. student@skillpath.ro',
                    required: true,
                    style: { width: '100%', padding: '0.5rem', boxSizing: 'border-box' }
                })
            ),
            React.createElement(
                'div',
                null,
                React.createElement('label', { style: { display: 'block', marginBottom: '0.25rem' } }, 'Role:'),
                React.createElement(
                    'select',
                    { name: 'role', style: { width: '100%', padding: '0.5rem' } },
                    React.createElement('option', { value: 'student' }, 'Student'),
                    React.createElement('option', { value: 'admin' }, 'Admin')
                )
            ),
            React.createElement(
                'button',
                { type: 'submit', style: { padding: '0.6rem', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' } },
                'Log In'
            )
        )
    );
}