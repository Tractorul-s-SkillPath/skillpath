/**
 * Tests for app/(admin)/admin/categories/actions.ts.
 *
 * Stories: SP-031, SP-032
 *
 * Cases
 *  - a student caller -> forbidden, and nothing is written
 *  - a 1-character name -> field error, no service call
 *  - a duplicate name -> a FIELD error on name, never an unhandled 500 (SP-031 AC2)
 *  - deactivate sets status and revalidates the list
 *  - there is no delete action exported from this file at all (SP-032)
 */
