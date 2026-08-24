/**
 * Assessment schemas.
 *
 * Stories: SP-040, SP-041, SP-043, SP-046, SP-055
 *
 * Sketch
 *  startSchema       categoryIds (>=1), requestedLevel
 *  saveAnswerSchema  assessmentId, questionId, answerId
 *  submitSchema      assessmentId — AND NOTHING ELSE
 *
 * submitSchema is the enforcement point for SP-055: a forged total_score in the
 * request body is not "ignored by convention", it fails to parse.
 *
 * Test: tests/lib/validation/assessment.schema.test.ts
 */
