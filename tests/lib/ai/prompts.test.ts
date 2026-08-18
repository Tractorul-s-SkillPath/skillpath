/**
 * Tests for lib/ai/prompts.ts.
 *
 * Story: SP-094
 *
 * Cases
 *  - each builder produces a non-empty prompt from a typed context
 *  - the output contains the first name and the scores and NOTHING else
 *    identifying: no email, no last name, no user id (SP-094)
 *  - the prompt asks for the exact JSON shape the Zod schema expects
 */
