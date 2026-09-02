/**
 * Plan action.
 *
 * Layer: ACTION — assertAuth -> zod.parse -> service -> revalidate (§3)
 * Story: SP-063
 *
 * The contract this file pins is the layer rule itself, and one security
 * property: the user id comes from the SESSION, never the form. A Server Action
 * is a public HTTP endpoint, and with no RLS underneath that argument is the
 * only thing stopping one member ticking off another's plan item (SP-063 AC2).
 *
 * The schema carries `recommendationId` and `status` and nothing else, so a
 * crafted POST cannot rewrite `topic_title` or `priority` (AC3) — asserted here
 * by checking the service is called with exactly those.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updatePlanStatusAction } from '../../../../app/(student)/plan/actions';
import * as planService from '../../../../lib/services/plan.service';
import { assertAuth } from '../../../../lib/auth/assertAuth';
import { revalidatePath } from 'next/cache';
import { aCurrentUser, MEMBER_ID } from '../../../helpers/builders';
import { ok, err } from '../../../../lib/result';
import { appError } from '../../../../lib/errors';
import { IDLE } from '../../../../lib/validation/common';

vi.mock('../../../../lib/services/plan.service');
vi.mock('../../../../lib/auth/assertAuth');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [k, v] of Object.entries(fields)) data.set(k, v);
    return data;
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertAuth).mockResolvedValue(aCurrentUser());
    vi.mocked(planService.setItemStatus).mockResolvedValue(ok(undefined));
});

describe('updatePlanStatusAction', () => {
    it('takes the user id from the session, not the form', async () => {
        // The form below claims to be user 999. The service must still be
        // called with the session's id.
        await updatePlanStatusAction(IDLE, form({ recommendationId: '5', status: 'completed', userId: '999' }));

        expect(planService.setItemStatus).toHaveBeenCalledWith(MEMBER_ID, 5, 'completed');
    });

    it('guards before it parses', async () => {
        // assertAuth redirects on a signed-out caller, so it must run first —
        // parsing an unauthenticated request tells an attacker which inputs are
        // valid before turning them away.
        await updatePlanStatusAction(IDLE, form({ recommendationId: '5', status: 'completed' }));

        expect(assertAuth).toHaveBeenCalledOnce();
    });

    it('sends only the two fields the schema allows', async () => {
        await updatePlanStatusAction(
            IDLE,
            form({ recommendationId: '5', status: 'completed', topicTitle: 'rewritten', priority: '1' }),
        );

        // SP-063 AC3: three arguments, and neither of the crafted ones is
        // among them.
        expect(planService.setItemStatus).toHaveBeenCalledWith(MEMBER_ID, 5, 'completed');
    });

    it('reports a success message that names what happened', async () => {
        const done = await updatePlanStatusAction(IDLE, form({ recommendationId: '5', status: 'completed' }));
        expect(done).toEqual({ status: 'success', message: 'Done — XP updated.' });

        const moved = await updatePlanStatusAction(IDLE, form({ recommendationId: '5', status: 'in_progress' }));
        expect(moved).toEqual({ status: 'success', message: 'Updated.' });
    });

    it('revalidates the plan, the dashboard and the layout', async () => {
        // Completing an item pays XP, which the header prints — revalidating
        // only /plan leaves a stale total in the bar above it.
        await updatePlanStatusAction(IDLE, form({ recommendationId: '5', status: 'completed' }));

        expect(revalidatePath).toHaveBeenCalledWith('/plan');
        expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
        expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    });

    it('rejects an unparseable input without calling the service', async () => {
        const result = await updatePlanStatusAction(IDLE, form({ recommendationId: 'abc', status: 'wizard' }));

        expect(result.status).toBe('error');
        expect(planService.setItemStatus).not.toHaveBeenCalled();
    });

    it('returns the service failure and does NOT revalidate', async () => {
        // Revalidating after a failed write repaints the page with the old row
        // and a success-shaped silence.
        vi.mocked(planService.setItemStatus).mockResolvedValue(
            err(appError('not_found', 'That plan item no longer exists.')),
        );

        const result = await updatePlanStatusAction(IDLE, form({ recommendationId: '5', status: 'completed' }));

        expect(result).toEqual({ status: 'error', message: 'That plan item no longer exists.', fields: undefined });
        expect(revalidatePath).not.toHaveBeenCalled();
    });
});
