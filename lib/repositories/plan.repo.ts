/**
 * recommendation_plans table.
 *
 * Layer: REPOSITORY
 * Stories: SP-061, SP-062, SP-063, SP-091
 *
 * Sketch: upsertMany(items) on (user_id, category_id, topic_title),
 * listForUser, updateStatus(id, status), setAiDescription(id, text).
 *
 * updateStatus writes ONE column. setAiDescription writes ONE column. Neither
 * takes a whole row — that is how SP-063's "only progress_status is written"
 * stops being a promise and starts being a signature.
 *
 * Test: tests/lib/repositories/plan.repo.test.ts (integration)
 */
