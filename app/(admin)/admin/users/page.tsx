/**
 * User management.
 *
 * Layer: PAGE
 * Story: SP-083
 *
 * Search by name or email, filter by role and status, paged server-side. Each
 * row can be activated or deactivated; a deactivated member is locked out
 * everywhere, because assertAuth() and loginAction both check status (SP-014).
 *
 * `searchParams` is a Promise in Next 16 and is typed as one here. It was typed
 * as a plain object and then awaited anyway, which happens to work at runtime
 * and lies to everybody reading it.
 */

import Link from 'next/link';
import { listUsers } from '../../../../lib/services/user-admin.service';
import { userFiltersSchema } from '../../../../lib/validation/filters.schema';
import { unwrapOr } from '../../../../lib/result';
import { setUserStatusAction } from './actions';
import { UserFilters } from './user-filters';
import { StatusToggle } from '../status-toggle';
import { Section } from '../../../../components/ui/card';
import { Chip } from '../../../../components/ui/chip';
import { buttonClass } from '../../../../components/ui/button';
import { EmptyState } from '../../../../components/empty-state';
import { Pagination } from '../../../../components/pagination';
import { fullName } from '../../../../lib/utils';

export const metadata = { title: 'Members · SkillPath admin' };

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
    const raw = await searchParams;

    // Never trusted, never allowed to fail the render: every field falls back
    // to a default rather than throwing on a hand-edited query string.
    const filters = userFiltersSchema.parse({
        search: raw.search,
        role: raw.role,
        status: raw.status,
        page: raw.page,
    });

    const result = await listUsers(filters);
    const { items, total, page, totalPages } = unwrapOr(result, {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1,
    });

    const buildHref = (target: number) => {
        const query = new URLSearchParams();

        if (filters.search) query.set('search', filters.search);
        if (filters.role) query.set('role', filters.role);
        if (filters.status) query.set('status', filters.status);
        query.set('page', String(target));

        return `/admin/users?${query}`;
    };

    return (
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 lg:py-10">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">Members</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {total === 1 ? '1 account matches' : `${total} accounts match`} these filters.
                    </p>
                </div>

                <Link href="/admin" className={buttonClass('ghost', 'sm')}>
                    ← Overview
                </Link>
            </header>

            <Section title="Filters" description="Filter state lives in the URL, so it survives a refresh.">
                <UserFilters
                    search={filters.search}
                    role={filters.role ?? ''}
                    status={filters.status ?? ''}
                />
            </Section>

            <Section title="Accounts" description="Deactivating a member signs them out of every page.">
                {items.length === 0 ? (
                    <EmptyState
                        title="No members match"
                        description="Try a shorter search, or reset the filters."
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle-foreground">
                                    <th scope="col" className="pb-2 pr-4 font-medium">Name</th>
                                    <th scope="col" className="pb-2 pr-4 font-medium">Email</th>
                                    <th scope="col" className="pb-2 pr-4 font-medium">Role</th>
                                    <th scope="col" className="pb-2 pr-4 font-medium">Status</th>
                                    <th scope="col" className="pb-2 text-center font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((user) => (
                                    <tr key={user.userId} className="border-b border-border last:border-0">
                                        <td className="py-3 pr-4 font-medium text-foreground">
                                            {fullName(user.firstName, user.lastName)}
                                        </td>
                                        <td className="py-3 pr-4 text-muted-foreground">{user.email}</td>
                                        <td className="py-3 pr-4 capitalize text-muted-foreground">
                                            {user.role}
                                        </td>
                                        <td className="py-3 pr-4">
                                            <Chip tone={user.status === 'active' ? 'success' : 'danger'}>
                                                {user.status}
                                            </Chip>
                                        </td>
                                        <td className="py-3">
                                            <StatusToggle
                                                action={setUserStatusAction}
                                                fields={{ userId: user.userId }}
                                                target={user.status === 'active' ? 'inactive' : 'active'}
                                                label={user.status === 'active' ? 'Deactivate' : 'Activate'}
                                                describedAs={fullName(user.firstName, user.lastName)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <Pagination
                    page={page}
                    totalPages={totalPages}
                    buildHref={buildHref}
                    label="Member"
                    className="mt-5 border-t border-border pt-4"
                />
            </Section>
        </div>
    );
}
