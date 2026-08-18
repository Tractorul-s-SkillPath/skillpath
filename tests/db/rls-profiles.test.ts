/**
 * RLS: profiles.
 *
 * Stories: SP-004, SP-012
 *
 * Cases
 *  - a student selects their own row -> 1 row
 *  - a student selects another student's row -> 0 rows (not an error — zero rows;
 *    assert the count, because an error and an empty result look the same in the UI)
 *  - a student updates their own names -> succeeds
 *  - a student updates another user's row -> 0 rows affected
 *  - an admin selects all -> every row
 *  - an anonymous token -> 0 rows
 */
