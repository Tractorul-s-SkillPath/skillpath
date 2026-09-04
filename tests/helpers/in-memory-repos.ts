/**
 * The repository doubles the service tests run against.
 *
 * ---------------------------------------------------------------------------
 * WHY THESE ARE NOT INJECTED, WHICH IS WHAT docs/TESTING.md PROMISES
 *
 * That document assumes services take their repositories as arguments. They do
 * not: every service reaches for a module namespace —
 * `import * as planRepo from '../repositories/plan.repo'` — and
 * lib/repositories/types.ts, where the interfaces were meant to live, is still
 * comment-only. There is nothing to inject into.
 *
 * Making that true would mean changing the signature of all eight services and
 * every Server Action that calls them, as a refactor of working production code
 * with no tests underneath it yet. So the substitution happens at the module
 * boundary instead: a test file calls `vi.mock(<repo path>)` and wires the
 * resulting auto-mocks to the fakes below.
 *
 * The rule that mattered is still kept. `tests/README.md` says: no mocking
 * supabase-js — in services, substitute the repository. That is exactly what
 * happens here; the client never appears, and no test knows what a PostgREST
 * filter chain looks like. When the repositories grow real interfaces, these
 * fakes become the injected implementations with their bodies unchanged.
 * ---------------------------------------------------------------------------
 */

import { vi } from 'vitest';
import { ok, err, type Result } from '../../lib/result';
import { appError, type AppError } from '../../lib/errors';
import type { PlanItem, PlanStatus } from '../../lib/domain/types';

/**
 * What every mocked `createClient()` hands back.
 *
 * Deliberately opaque. If a service ever starts calling a method on it, the
 * test fails with "not a function" rather than quietly passing — which is the
 * signal that query-building has leaked out of the repository layer.
 */
export const FAKE_CLIENT = Object.freeze({ __fakeSupabaseClient: true }) as never;

/** A database failure, for the error-propagation half of each service test. */
export function aRepoFailure(message = 'Something went wrong. Try again.'): AppError {
    return appError('unknown', message);
}

/**
 * A stateful stand-in for plan.repo.
 *
 * Ownership lives in the repository (every query carries `.eq('user_id', …)`),
 * so the fake enforces it too — otherwise a service test could not tell a
 * missing item from someone else's, which is the distinction plan.service
 * exists to make.
 */
export function createPlanRepo(seed: ReadonlyArray<{ userId: string; item: PlanItem }> = []) {
    const rows = seed.map((row) => ({ ...row, item: { ...row.item } }));

    return {
        rows,

        listByUser: vi.fn(
            async (_client: unknown, userId: string): Promise<Result<PlanItem[], AppError>> =>
                ok(
                    rows
                        .filter((row) => row.userId === userId)
                        .map((row) => row.item)
                        .sort((a, b) => a.priority - b.priority),
                ),
        ),

        findById: vi.fn(
            async (
                _client: unknown,
                userId: string,
                recommendationId: number,
            ): Promise<Result<PlanItem | null, AppError>> => {
                const found = rows.find(
                    (row) =>
                        row.userId === userId && row.item.recommendationId === recommendationId,
                );

                return ok(found ? found.item : null);
            },
        ),

        setStatus: vi.fn(
            async (
                _client: unknown,
                userId: string,
                recommendationId: number,
                status: PlanStatus,
            ): Promise<Result<void, AppError>> => {
                const found = rows.find(
                    (row) =>
                        row.userId === userId && row.item.recommendationId === recommendationId,
                );

                if (!found) return err(aRepoFailure('No row matched the update.'));

                found.item.status = status;
                return ok(undefined);
            },
        ),
    };
}

export type PlanRepoFake = ReturnType<typeof createPlanRepo>;
