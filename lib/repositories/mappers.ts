/**
 * snake_case row -> camelCase domain type. Pure.
 *
 * Convention §8: this mapping happens in the repository layer and nowhere else.
 * It lives in its own file because it is pure, and pure code is cheap to test.
 *
 * Sketch: toProfile(row), toQuestion(row), toAnswerOption(row), toAssessment(row),
 * toResponse(row), toPlanItem(row), toCategoryProgress(row).
 * numeric(5,2) arrives as a string from PostgREST — parse it here, once, and
 * every layer above can trust it is a number.
 *
 * Test: tests/lib/repositories/mappers.test.ts (unit, no database)
 */
