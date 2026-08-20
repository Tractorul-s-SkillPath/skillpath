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
import { loginAction } from '../../../lib/auth/current-user';

export default function LoginPage() {
    return React.createElement(
        'main',
        { style: { maxWidth: '400px', margin: '4rem auto', fontFamily: 'sans-serif', padding: '1.5rem', border: '1px solid #ccc', borderRadius: '8px' } },
        React.createElement('h2', null, 'Log In to SkillPath'),
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
        )
    );
}