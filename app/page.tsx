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
import Link from 'next/link';
import { getCurrentUser, logoutAction } from '../lib/auth/current-user';

export default async function HomePage() {
    const user = await getCurrentUser();

    if (user) {
        return React.createElement(
            'main',
            { style: { maxWidth: '400px', margin: '4rem auto', fontFamily: 'sans-serif', padding: '1.5rem', border: '1px solid #ccc', borderRadius: '8px', textAlign: 'center' } },
            React.createElement('h2', null, 'SkillPath Platform'),
            React.createElement('p', { style: { color: 'green', fontWeight: 'bold' } }, `Welcome back, ${user.email}!`),
            React.createElement('p', null, `Role: ${user.role}`),
            React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' } },
                React.createElement(
                    Link,
                    { href: user.role === 'admin' ? '/admin' : '/dashboard', style: { padding: '0.6rem', background: '#0070f3', color: 'white', borderRadius: '4px', textDecoration: 'none' } },
                    'Go to Dashboard'
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
            )
        );
    }

    return React.createElement(
        'main',
        { style: { maxWidth: '400px', margin: '4rem auto', fontFamily: 'sans-serif', padding: '1.5rem', border: '1px solid #ccc', borderRadius: '8px', textAlign: 'center' } },
        React.createElement('h2', null, 'SkillPath Authentication'),
        React.createElement('p', null, 'Please log in or register to access the platform.'),
        React.createElement(
            'div',
            { style: { display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' } },
            React.createElement(
                Link,
                { href: '/login', style: { padding: '0.6rem 1.2rem', background: '#0070f3', color: 'white', borderRadius: '4px', textDecoration: 'none' } },
                'Log In'
            ),
            React.createElement(
                Link,
                { href: '/register', style: { padding: '0.6rem 1.2rem', border: '1px solid #ccc', color: '#333', borderRadius: '4px', textDecoration: 'none' } },
                'Register'
            )
        )
    );
}