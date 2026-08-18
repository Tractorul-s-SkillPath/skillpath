/**
 * skill_categories table.
 *
 * Layer: REPOSITORY
 * Stories: SP-030, SP-031, SP-032, SP-040
 *
 * Sketch: listPaged (with question counts, one query with a join — not N+1),
 * listActiveWithEligibleQuestions, insert, update, setStatus.
 * A unique violation is translated into a typed conflict here, not swallowed.
 *
 * Test: tests/lib/repositories/category.repo.test.ts (integration)
 */
