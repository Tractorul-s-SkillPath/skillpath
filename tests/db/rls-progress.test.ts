/**
 * RLS: category_progress.
 *
 * Stories: SP-004, SP-054
 *
 * Cases
 *  - a student reads their own progress rows only
 *  - a student cannot insert or update ANY progress row — writes are
 *    service-role only, so a student cannot promote themselves to 'advanced'
 *  - an admin reads all
 */
