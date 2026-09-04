/**
 * Profile page.
 *
 * Layer: PAGE — fetch through the service, render. Never a repository (§3.2).
 * Stories: SP-020, SP-021, SP-022, SP-101 … SP-105
 *
 * One long scrollable page: identity at the top, then interests and levels,
 * history, and the game layer. Each section saves on its own, so nothing
 * is a single giant form that loses work when one field is wrong. The learning
 * plan lives on its own page now — /plan — where the nav has pointed all along.
 *
 * The game layer is computed, not stored (lib/domain/derived.ts) — the database
 * schema was left exactly as it was found.
 */

import { notFound, redirect } from 'next/navigation';
import { assertAuth } from '../../../lib/auth/assertAuth';
import { getProfileDashboard } from '../../../lib/services/profile.service';
import { ProfileHeader } from './profile-header';
import { InterestsSection } from './interests-section';
import { AssessmentHistory } from './assessment-history';
import { BadgesSection, LeaderboardSection, QuestsSection } from './game-sections';
import { Section } from '../../../components/ui/card';
import Link from 'next/link';

export const metadata = { title: 'Your profile · SkillPath' };

// Everything here is per-member and changes as they use the app.
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
    const user = await assertAuth();

    // Everything below this line is the student game layer — interests, plan,
    // history, XP, quests, badges, leaderboard — and an admin has none of it.
    // The menu sends them to /admin/account instead, so this only catches a
    // typed URL or an old bookmark. Same role-based redirect the auth layout
    // and app/page.tsx already do.
    if (user.role === 'admin') {
        redirect('/admin/account');
    }

    const result = await getProfileDashboard(user.userId);

    // The member's own row is the one fatal read: without it there is no page.
    if (!result.ok) notFound();

    const {
        profile,
        interests,
        catalog,
        assessments,
        xp,
        streak,
        overallLevel,
        badges,
        quests,
        leaderboard,
        myRank,
    } = result.value;

    return (
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 lg:py-10">
            <ProfileHeader profile={profile} xp={xp} streak={streak} overallLevel={overallLevel} />

            <InterestsSection interests={interests} catalog={catalog} />

            <AssessmentHistory assessments={assessments} />

            <QuestsSection quests={quests} />

            <BadgesSection badges={badges} />

            <LeaderboardSection entries={leaderboard} myRank={myRank} />

            <Section id="account" title="Account" description="Managed by SkillPath, not by you.">
                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[8rem_1fr] items-center">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd>{profile.email}</dd>

                    <dt className="text-muted-foreground">Role</dt>
                    <dd className="capitalize">{profile.role}</dd>

                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="capitalize">{profile.status}</dd>

                    <dt className="text-muted-foreground">Password</dt>
                    <dd>
                        <Link
                            href="/settings/password"
                            className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted transition-colors"
                        >
                            Change password
                        </Link>
                    </dd>
                </dl>
            </Section>
        </div>
    );
}
