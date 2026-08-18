/**
 * Profile update schema.
 *
 * Stories: SP-021, SP-022
 *
 * Sketch: firstName/lastName (<= 60), interests (array of category ids),
 * learningObjective (max length, enforced BOTH sides — SP-022).
 *
 * There is no `role` and no `status` key. The schema is the contract; a field
 * that cannot be parsed cannot be written.
 *
 * Test: tests/lib/validation/profile.schema.test.ts
 */
