/**
 * User administration.
 *
 * Layer: SERVICE
 * Stories: SP-083, SP-014
 *
 * Role changes are deliberately absent. Promotion is scripts/promote-admin.sql
 * (SP-015); putting it on this screen needs its own story and its own tests,
 * because "make this person an admin" is a one-click privilege escalation if
 * the check above it is ever wrong.
 *
 * Test: tests/lib/services/user-admin.service.test.ts
 */

import 'server-only';
import { assertAdmin } from '../auth/assertAdmin';
import { createClient } from '../supabase/server';
import * as userRepo from '../repositories/user.repo';
import type { UserStatus } from '../supabase/database.types';
import { appError, type AppError } from '../errors';
import { err, type Result } from '../result';
import type { ManagedUser, Page } from '../domain/types';
import { PAGE_SIZE, type UserFilterInput } from '../validation/filters.schema';

export async function listUsers(
    filters: UserFilterInput,
): Promise<Result<Page<ManagedUser>, AppError>> {
    await assertAdmin();

    return userRepo.listPaged(await createClient(), {
        search: filters.search,
        role: filters.role,
        status: filters.status,
        page: filters.page,
        pageSize: PAGE_SIZE,
    });
}

/**
 * Activate or deactivate a member.
 *
 * A deactivated account is locked out everywhere: assertAuth() rejects a
 * non-active status on every protected page, and loginAction refuses to create
 * a session for one (SP-014). So this is a real switch, not a label.
 *
 * AN ADMIN MAY NOT DEACTIVATE THEMSELVES. With one administrator — which is
 * this project's normal state — doing so locks the last person out of /admin
 * and the only way back in is scripts/promote-admin.sql against the database.
 * The check is here rather than in the action because it is a rule about who
 * may do what, which is what this layer is for.
 */
export async function setUserStatus(
    userId: number,
    status: UserStatus,
): Promise<Result<void, AppError>> {
    const admin = await assertAdmin();

    if (userId === admin.userId && status === 'inactive') {
        return err(
            appError(
                'forbidden',
                'You cannot deactivate your own account — you would lock yourself out of the admin area.',
            ),
        );
    }

    return userRepo.setStatus(await createClient(), userId, status);
}
