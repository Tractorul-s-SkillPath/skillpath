/**
 * Tests for lib/repositories/mappers.ts. Unit — no database.
 *
 * Cases
 *  - snake_case row -> camelCase type, every field mapped, nothing dropped
 *  - numeric(5,2) arrives as the string "82.50" and comes out as the number 82.5
 *  - nullable columns (selected_answer_id, is_correct, submitted_at) map to null,
 *    not undefined and not 0
 *  - toAnswerOption produces a type with NO isCorrect field (SP-038)
 *  - timestamptz strings become Dates in one place only
 */
