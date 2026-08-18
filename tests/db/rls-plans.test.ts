/**
 * RLS: recommendation_plans.
 *
 * Stories: SP-004, SP-063
 *
 * Cases
 *  - a student reads their own plan rows only
 *  - a student updates progress_status on their own item -> succeeds
 *  - a student updating another student's item -> 0 rows (SP-063 AC2)
 *  - a student attempting to change topic_title or priority on their own item
 *    -> refused or reverted (SP-063 AC3), asserted in SQL, not just in the action
 *  - a student cannot insert a plan row (plans are generated server-side)
 *  - an admin reads all
 */
