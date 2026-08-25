/**
 * The admin's own account.
 *
 * Layer: PAGE
 *
 * WHY THIS EXISTS
 *
 * The user menu used to send everybody to /profile. That page lives in the
 * (student) group, so an administrator clicking "Your profile" was dropped out
 * of the admin shell entirely — admin nav replaced by Dashboard / Assessments /
 * Plan / Profile, and a "Level 1" XP badge — to look at seven sections that
 * were all either meaningless or permanently empty for them: interests,
 * assessment history, learning plan, quests, badges, leaderboard.
 *
 * This page is the half that was real: who you are, and the facts about the
 * account. An admin can rename themselves and read their own role and status.
 *
 * DELIBERATELY NOT getProfileDashboard(). That service fetches badges, quests
 * and a leaderboard — an expensive read whose entire result would be discarded
 * here. assertAdmin() already returns the user row, which is the whole of what
 * this page renders.
 */

import Link from 'next/link';
import { assertAdmin } from '../../../../lib/auth/assertAdmin';
import { NameForm } from './name-form';
import { Section } from '../../../../components/ui/card';
import { Chip } from '../../../../components/ui/chip';
import { buttonClass } from '../../../../components/ui/button';
import { formatDate } from '../../../../lib/utils';

export const metadata = { title: 'Your account · SkillPath admin' };

// Reads the session on every request.
export const dynamic = 'force-dynamic';

export default async function AdminAccountPage() {
    const admin = await assertAdmin();
    const { user } = admin;

    return (
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 lg:py-10">
            <div className="flex justify-end">
                <Link href="/admin" className={buttonClass('ghost', 'sm')}>
                    ← Overview
                </Link>
            </div>

            <NameForm user={user} />

            <Section
                title="Account"
                description="Managed by SkillPath, not by you."
                className="rise stagger-1"
            >
                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[8rem_1fr]">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd>{user.email}</dd>

                    <dt className="text-muted-foreground">Role</dt>
                    <dd>
                        <Chip tone="accent">Administrator</Chip>
                    </dd>

                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                        <Chip tone={user.status === 'active' ? 'success' : 'danger'}>
                            {user.status}
                        </Chip>
                    </dd>

                    <dt className="text-muted-foreground">Member since</dt>
                    <dd className="tabular">{formatDate(user.created_at)}</dd>
                </dl>
            </Section>

            <Section
                title="What an administrator can do"
                description="Your access, in plain terms."
                className="rise stagger-2"
            >
                <ul className="space-y-2 text-[0.8125rem] leading-relaxed text-muted-foreground">
                    <li>Read every member&apos;s results, and activate or deactivate accounts.</li>
                    <li>Edit the category catalogue and the question bank behind it.</li>
                    <li>
                        You do not take assessments, so you have no XP, no learning plan and no
                        place on the leaderboard.
                    </li>
                </ul>
            </Section>
        </div>
    );
}
