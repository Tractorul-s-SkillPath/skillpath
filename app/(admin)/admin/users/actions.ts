/**
 * User admin actions.
 *
 * Layer: ACTION
 * Stories: SP-083, SP-014
 *
 * Sketch
 *  setUserStatus({ userId, status })
 *   - assertAdmin; an inactive user is locked out everywhere because is_admin()
 *     and the login path both check status (SP-014)
 *   - role changes: out of scope for the MVP. Promotion is scripts/promote-admin.sql
 *     (SP-015). If we ever add it here, it needs its own story and its own test.
 *
 * Test: tests/app/(admin)/admin/users/actions.test.ts
 */
