/**
 * Tests for lib/auth/assertAdmin.ts.
 *
 * Stories: SP-012, SP-037
 *
 * Cases
 *  - student -> forbidden
 *  - anonymous -> unauthenticated (not forbidden — different status, on purpose)
 *  - active admin -> passes
 *  - INACTIVE admin -> forbidden, matching SQL is_admin()'s status check (SP-014)
 */
