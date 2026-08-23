/**
 * User search + filters.
 *
 * Stories: SP-083, SP-085
 *
 * A plain GET form, so the filter state ends up in the URL and the screen works
 * with JavaScript off. `method="GET"` also means the browser drops empty fields
 * on its own, so "All roles" produces `?role=` rather than a stray value the
 * server has to interpret — filters.schema.ts treats that as "no filter".
 *
 * There is deliberately no hidden `page` input: changing a filter must return
 * to page 1, and the surest way to do that is not to carry the old page number.
 */

import { Input } from '../../../../components/ui/field';
import { Button, buttonClass } from '../../../../components/ui/button';

interface UserFiltersProps {
    search: string;
    role: string;
    status: string;
}

export function UserFilters({ search, role, status }: UserFiltersProps) {
    const select =
        'h-9.5 rounded-lg border border-border-strong bg-surface px-3 text-sm text-foreground';

    return (
        <form method="GET" action="/admin/users" className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-1.5">
                <label htmlFor="user-search" className="block text-[0.8125rem] font-medium">
                    Search
                </label>
                <Input
                    id="user-search"
                    type="search"
                    name="search"
                    defaultValue={search}
                    placeholder="Name or email"
                />
            </div>

            <div className="space-y-1.5">
                <label htmlFor="user-role" className="block text-[0.8125rem] font-medium">
                    Role
                </label>
                <select id="user-role" name="role" defaultValue={role} className={select}>
                    <option value="">All roles</option>
                    <option value="student">Student</option>
                    <option value="admin">Admin</option>
                </select>
            </div>

            <div className="space-y-1.5">
                <label htmlFor="user-status" className="block text-[0.8125rem] font-medium">
                    Status
                </label>
                <select id="user-status" name="status" defaultValue={status} className={select}>
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>

            <div className="flex gap-2">
                <Button type="submit" variant="primary">
                    Apply
                </Button>
                <a href="/admin/users" className={buttonClass('ghost')}>
                    Reset
                </a>
            </div>
        </form>
    );
}

export default UserFilters;
