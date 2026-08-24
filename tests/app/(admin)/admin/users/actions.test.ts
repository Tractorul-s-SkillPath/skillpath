/**
 * Tests for app/(admin)/admin/users/actions.ts.
 *
 * Stories: SP-083, SP-014
 *
 * Cases
 *  - a student caller -> forbidden, no write
 *  - setStatus persists and revalidates the list
 *  - an admin deactivating themselves is refused
 *  - no role field is accepted by this action (promotion is SP-015's script)
 */
