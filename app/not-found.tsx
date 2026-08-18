/**
 * 404.
 *
 * Story: SP-053 — opening another student's assessment id must land here,
 * because RLS returned zero rows, not because an `if` said so.
 */

import React from 'react';

export default function NotFound()
{
    return React.createElement(
        'div',
        { style: { padding: '3rem', textAlign: 'center', fontFamily: 'sans-serif' } },
        React.createElement('h2', null, '404 - Pagina nu a fost gasita'),
        React.createElement('p', null, 'Resursa cautata nu exista sau nu aveti acces la ea.')
    );
}