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
                title="Security"
                description="Manage your password and account security."
                className="rise stagger-2"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium">Password</p>
                        <p className="text-xs text-muted-foreground">
                            Update your password regularly to keep your account secure.
                        </p>
                    </div>
                    <Link href="/settings/password" className={buttonClass('secondary', 'sm')}>
                        Change password
                    </Link>
                </div>
            </Section>

            <Section
                title="What an administrator can do"
                description="Your access, in plain terms."
                className="rise stagger-3"
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
