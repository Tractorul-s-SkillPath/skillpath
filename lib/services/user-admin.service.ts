/**
 * User administration.
 *
 * Layer: SERVICE
 * Stories: SP-083, SP-014
 *
 * Sketch
 *  listUsers({ search, role, status, page })  - search on name/email, bounded
 *  setStatus(userId, status)                  - assertAdmin
 *   - an admin cannot deactivate themselves; that is how you lock everyone out
 *     the night before the demo
 *
 * Test: tests/lib/services/user-admin.service.test.ts
 */
