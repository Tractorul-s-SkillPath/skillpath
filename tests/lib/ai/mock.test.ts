/**
 * Tests for lib/ai/mock.ts.
 *
 * Story: SP-090
 *
 * Cases
 *  - deterministic: same input twice -> identical output
 *  - its output passes the Zod schemas in lib/ai/schemas.ts (a fixture that
 *    would not survive validation is a fixture that hides bugs)
 *  - the injectable failure modes really do throw / hang / return malformed data
 */
