/**
 * Tests for app/(student)/assessments/new/actions.ts.
 *
 * Stories: SP-041, SP-042
 *
 * Cases
 *  - unauthenticated -> refused before any service call
 *  - a bad categoryId or level -> field errors, no generation
 *  - success -> redirect to /assessments/[newId]
 *  - an existing in-progress run -> redirect to THAT id, and generate is not
 *    called a second time (SP-042)
 *  - a category with too few questions -> the documented refusal message
 */
