/**
 * Logout server action.
 *
 * Layer: ACTION
 * Story: SP-010
 *
 * Sketch
 *  - supabase.auth.signOut(), clear cookies
 *  - revalidatePath('/', 'layout') so no RSC payload survives in the client cache
 *  - redirect('/login')
 *
 * Test: tests/app/(auth)/logout/actions.test.ts — asserts the Back-button case.
 */

import React from 'react';
import { logoutAction } from '../../../lib/auth/current-user';

export default function LogoutPage() {
    return React.createElement(
        'main',
        { style: { maxWidth: '400px', margin: '4rem auto', fontFamily: 'sans-serif', padding: '1.5rem', border: '1px solid #ccc', borderRadius: '8px', textAlign: 'center' } },
        React.createElement('h2', null, 'Log Out'),
        React.createElement('p', null, 'Are you sure you want to log out of SkillPath?'),
        React.createElement(
            'form',
            { action: logoutAction, style: { marginTop: '1.5rem' } },
            React.createElement(
                'button',
                { type: 'submit', style: { padding: '0.6rem 1.5rem', background: '#e53e3e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' } },
                'Confirm Log Out'
            )
        )
    );
}