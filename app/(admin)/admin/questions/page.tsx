/**
 * Question bank list.
 *
 * Layer: PAGE
 * Stories: SP-033, SP-084, SP-086
 *
 * Sketch
 *  - columns: text, category, difficulty, status, source (manual / ai)
 *  - SERVER-side pagination and filtering; no endpoint returns an unbounded set
 *  - reads go through question.service (service role, assertAdmin) because
 *    `answers` is unreachable over PostgREST by design (§5)
 */
