/**
 * Tests for lib/validation/profile.schema.ts.
 *
 * Stories: SP-021, SP-022
 *
 * Cases
 *  - valid update parses
 *  - objective at max length passes, one over fails (SP-022)
 *  - interests must be existing category ids; an empty array is allowed
 *  - a payload carrying role='admin' parses WITHOUT that key surviving —
 *    the schema strips it, which is SP-013's first line of defence
 */
