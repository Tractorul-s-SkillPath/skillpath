/**
 * Login page.
 *
 * Layer: PAGE — renders the form, no logic
 * Story: SP-010
 *
 * Sketch
 *  - <LoginForm /> + link to /register
 *  - reads ?next= so middleware can send the user back where they were
 */

import React from 'react';
import Link from 'next/link';
import { loginAction } from './actions';

interface LoginPageProps {
    searchParams?: Promise<{ error?: string }> | { error?: string };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const resolvedParams = searchParams ? await searchParams : undefined;
    const error = resolvedParams?.error;

    return React.createElement(
        'main',
        { style: { maxWidth: '400px', margin: '4rem auto', fontFamily: 'sans-serif', padding: '1.5rem', border: '1px solid #ccc', borderRadius: '8px' } },
        React.createElement('h2', null, 'Log In to SkillPath'),

        error && React.createElement(
            'div',
            { style: { backgroundColor: '#ffe6e6', color: '#d9534f', padding: '0.75rem', borderRadius: '4px', marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem', border: '1px solid #f5c6cb' } },
            'Email sau parolă incorectă. Te rugăm să încerci din nou.'
        ),

        React.createElement(
            'form',
            { action: loginAction, style: { display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' } },
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
                React.createElement('label', { style: { display: 'block', marginBottom: '0.25rem' } }, 'Password:'),
                React.createElement('input', {
                    type: 'password',
                    name: 'password',
                    placeholder: 'Enter your password',
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
                { type: 'submit', style: { padding: '0.6rem', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '0.5rem' } },
                'Log In'
            )
        ),

        // Link-ul de Register
        React.createElement(
            'div',
            { style: { textAlign: 'center', marginTop: '1.2rem', fontSize: '0.9rem', color: '#555' } },
            "Don't have an account? ",
            React.createElement(
                Link,
                { href: '/register', style: { color: '#0070f3', textDecoration: 'none', fontWeight: 'bold' } },
                'Register'
            )
        ),

        // Link-ul de „Back to Home” stilizat la fel ca cel de la Register
        React.createElement(
            'div',
            { style: { textAlign: 'center', marginTop: '0.6rem', fontSize: '0.9rem' } },
            React.createElement(
                Link,
                { href: '/', style: { color: '#0070f3', textDecoration: 'none', fontWeight: 'bold' } },
                'Back to Home'
            )
        )
    );
}