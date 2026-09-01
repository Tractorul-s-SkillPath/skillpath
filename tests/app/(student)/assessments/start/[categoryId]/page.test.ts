/**
 * Tests for app/(student)/assessments/start/[categoryId]/page.tsx.
 *
 * Stories: SP-040, SP-041, SP-042
 *
 * This spec used to sit at tests/app/(student)/assessments/new/actions.test.ts,
 * against a Server Action that no longer exists. The behaviour moved to a route
 * because the run has to open in a new tab and only a real link does that
 * reliably — see the page's header for the full reasoning. The cases below are
 * the same ones; what changed is that the outcome is a redirect rather than a
 * returned FormState, and there are no field errors to assert because there is
 * no form.
 *
 * Cases
 *  - unauthenticated -> assertAuth redirects, and startCategory is never called
 *  - a non-numeric categoryId -> redirect to /assessments, no run created
 *  - categoryId 0 -> redirect to /assessments; positive() rejects the
 *    baseline's sentinel, which starts through its own door (SP-040)
 *  - success -> redirect to /assessments/[newId]
 *  - an existing in-progress run -> redirect to THAT id, and no second run is
 *    created (SP-042) — the find-or-create is what makes this GET-that-writes
 *    safe to refresh, double-click or restore from a reopened tab
 *  - a category with too few questions -> redirect to /assessments, where the
 *    list already spells out why it is unavailable
 *  - a failed service call -> redirect to /assessments rather than a crash
 *
 * Note for whoever writes this: `redirect()` throws. Mock next/navigation so it
 * throws too, or the page carries on past the guard and the test proves nothing
 * — see tests/lib/auth/assertAuth.test.ts, which explains it at length.
 */
