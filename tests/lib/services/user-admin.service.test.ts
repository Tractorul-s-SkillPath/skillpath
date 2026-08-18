/**
 * Tests for lib/services/user-admin.service.ts.
 *
 * Stories: SP-083, SP-014
 *
 * Cases
 *  - a non-admin caller -> forbidden, no write
 *  - search matches on name and on email, case-insensitively
 *  - role and status filters combine
 *  - setStatus('inactive') persists
 *  - an admin cannot deactivate their own account
 */
