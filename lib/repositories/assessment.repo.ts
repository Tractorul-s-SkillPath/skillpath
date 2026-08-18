/**
 * assessments table.
 *
 * Layer: REPOSITORY
 * Stories: SP-041, SP-042, SP-046, SP-047, SP-082
 *
 * Sketch: findInProgress(userId, categoryId), createWithResponses (one RPC /
 * transaction — see 0001; two round-trips can half-succeed), findForUser,
 * markSubmitted(score), markAbandoned, listAll(filters) for admin.
 *
 * The unique-violation on one_active_assessment_per_user_category is caught here
 * and returned as a conflict carrying the existing id, so the action can just
 * redirect (SP-042).
 *
 * Test: tests/lib/repositories/assessment.repo.test.ts (integration)
 */
