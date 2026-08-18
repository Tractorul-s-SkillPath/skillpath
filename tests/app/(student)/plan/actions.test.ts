/**
 * Tests for app/(student)/plan/actions.ts.
 *
 * Story: SP-063
 *
 * Cases
 *  - a valid transition persists and revalidates /plan
 *  - an invalid status string -> rejected at the schema
 *  - a payload also carrying topic_title/priority -> only progress_status
 *    reaches the service (SP-063 AC3)
 *  - another student's item -> forbidden, surfaced as a message, not a crash
 */
