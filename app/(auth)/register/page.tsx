/**
 * Registration page.
 *
 * Layer: PAGE
 * Story: SP-011
 *
 * Sketch: <RegisterForm /> + link to /login.
 */

import React from 'react';
import Link from 'next/link';
import { registerAction } from '../../../lib/auth/current-user';
import { SKILL_CATEGORIES } from '../../../lib/constants/skills';

export default function RegisterPage() {
    return React.createElement(
        'main',
        { style: { maxWidth: '600px', margin: '4rem auto', fontFamily: 'sans-serif', padding: '1.5rem', border: '1px solid #ccc', borderRadius: '8px' } },
        React.createElement('h2', { style: { textAlign: 'center' } }, 'Create an Account'),
        React.createElement(
            'form',
            { action: registerAction, style: { display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' } },

            // Câmp name
            React.createElement(
                'div',
                null,
                React.createElement('label', { style: { display: 'block', marginBottom: '0.25rem' } }, 'First Name:'),
                React.createElement('input', {
                    type: 'text',
                    name: 'firstName',
                    placeholder: 'John',
                    required: true,
                    style: { width: '100%', padding: '0.5rem', boxSizing: 'border-box' }
                })
            ),
            React.createElement(
                'div',
                null,
                React.createElement('label', { style: { display: 'block', marginBottom: '0.25rem' } }, 'Last Name:'),
                React.createElement('input', {
                    type: 'text',
                    name: 'lastName',
                    placeholder: 'Doe',
                    required: true,
                    style: { width: '100%', padding: '0.5rem', boxSizing: 'border-box' }
                })
            ),

            // Câmp email
            React.createElement(
                'div',
                null,
                React.createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' } }, 'Email:'),
                React.createElement('input', {
                    type: 'email',
                    name: 'email',
                    placeholder: 'student@skillpath.ro',
                    required: true,
                    style: { width: '100%', padding: '0.5rem', boxSizing: 'border-box' }
                })
            ),

            // Câmp password
            React.createElement(
                'div',
                null,
                React.createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' } }, 'Password:'),
                React.createElement('input', {
                    type: 'password',
                    name: 'password',
                    placeholder: '••••••••',
                    required: true,
                    style: { width: '100%', padding: '0.5rem', boxSizing: 'border-box' }
                })
            ),

            // Câmp student/admin
            React.createElement(
                'div',
                { style: { marginTop: '1rem' } },
                React.createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' } }, 'I am registering as:'),
                React.createElement(
                    'select',
                    { name: 'role', style: { width: '100%', padding: '0.5rem', borderRadius: '4px' } },
                    React.createElement('option', { value: 'student' }, 'Student'),
                    React.createElement('option', { value: 'admin' }, 'Admin')
                )
            ),

            // Câmp skill-uri
            React.createElement(
                'div',
                { style: { marginTop: '1rem' } },
                React.createElement('label', { style: { display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' } }, 'Select Skills of Interest:'),
                SKILL_CATEGORIES.map((section) =>
                    React.createElement(
                        'div',
                        { key: section.category, style: { marginBottom: '1rem', background: '#f9f9f9', padding: '0.75rem', borderRadius: '4px' } },
                        React.createElement('h4', { style: { margin: '0 0 0.5rem 0', color: '#333' } }, section.category),
                        React.createElement(
                            'div',
                            { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' } },
                            section.skills.map((skill) =>
                                React.createElement(
                                    'label',
                                    { key: skill, style: { display: 'flex', alignItems: 'center', fontSize: '0.85rem', cursor: 'pointer' } },
                                    React.createElement('input', {
                                        type: 'checkbox',
                                        name: 'skills',
                                        value: skill,
                                        style: { marginRight: '0.4rem' }
                                    }),
                                    skill
                                )
                            )
                        )
                    )
                )
            ),

            // Buton submit
            React.createElement(
                'button',
                { type: 'submit', style: { padding: '0.8rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '0.5rem', fontWeight: 'bold' } },
                'Register'
            ),

            // Link către Login
            React.createElement(
                'div',
                { style: { textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem', color: '#666' } },
                'Already have an account? ',
                React.createElement(
                    Link,
                    { href: '/login', style: { color: '#0070f3', textDecoration: 'none', fontWeight: 'bold' } },
                    'Log In'
                )
            )
        )
    );
}