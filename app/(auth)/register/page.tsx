/**
 * Registration page.
 *
 * Layer: PAGE
 * Story: SP-011
 *
 * Sketch: <RegisterForm /> + link to /login.
 */

import React from 'react';
import { loginAction } from '../../../lib/auth/current-user';

export default function RegisterPage() {
    return React.createElement(
        'main',
        { style: { maxWidth: '400px', margin: '4rem auto', fontFamily: 'sans-serif', padding: '1.5rem', border: '1px solid #ccc', borderRadius: '8px' } },
        React.createElement('h2', null, 'Create an Account'),
        React.createElement(
            'form',
            { action: loginAction, style: { display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' } },
            React.createElement(
                'div',
                null,
                React.createElement('label', { style: { display: 'block', marginBottom: '0.25rem' } }, 'Full Name:'),
                React.createElement('input', {
                    type: 'text',
                    name: 'name',
                    placeholder: 'John Doe',
                    required: true,
                    style: { width: '100%', padding: '0.5rem', boxSizing: 'border-box' }
                })
            ),
            React.createElement(
                'div',
                null,
                React.createElement('label', { style: { display: 'block', marginBottom: '0.25rem' } }, 'Email:'),
                React.createElement('input', {
                    type: 'email',
                    name: 'email',
                    placeholder: 'student@skillpath.ro',
                    required: true,
                    style: { width: '100%', padding: '0.5rem', boxSizing: 'border-box' }
                })
            ),
            React.createElement(
                'button',
                { type: 'submit', style: { padding: '0.6rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '0.5rem' } },
                'Register'
            )
        )
    );
}