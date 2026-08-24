/**
 * Student route-group layout.
 *
 * Layer: PAGE
 * Story: SP-012
 *
 * assertAuth() here is the real guard. The middleware redirect is a
 * convenience; this, plus RLS, is what actually protects the group. Admins are
 * allowed in — only /admin is role-restricted.
 */

import * as React from 'react';
import { assertAuth } from '../../lib/auth/assertAuth';
import { SiteHeader } from '../../components/layout/site-header';
import { getHeaderXp } from '../../lib/services/profile.service';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
    const user = await assertAuth();

    // XP is derived, so the header has to compute it rather than read a column.
    const xp = await getHeaderXp(user.userId);

    return (
        <div className="min-h-dvh bg-background">
            <SiteHeader user={user.user} xp={xp} />
            <main>{children}</main>
        </div>
    );
}
