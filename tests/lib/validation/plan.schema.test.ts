/**
 * Tests for lib/validation/plan.schema.ts.
 *
 * Story: SP-063
 *
 * Cases
 *  - a valid status transition payload parses
 *  - an unknown status string is rejected
 *  - topicTitle and priority in the payload do not survive parsing (SP-063 AC3)
 */
