/**
 * Integration tests for lib/repositories/progress.repo.ts.
 *
 * Story: SP-054
 *
 * Cases
 *  - the first upsert inserts, the second UPDATES — the (user, category) unique
 *    constraint means a second assessment never duplicates the row
 *  - updated_at moves on update
 *  - a student can read their own row and cannot read another student's
 *  - a student token cannot write the row at all (writes are service-role only)
 */
