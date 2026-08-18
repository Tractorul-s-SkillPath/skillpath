/**
 * Tests for lib/errors.ts.
 *
 * Cases
 *  - every kind has a user-safe message
 *  - a Postgres unique-violation maps to 'conflict' with the right field
 *  - a Postgres RLS/permission error maps to 'forbidden', not 'not_found'
 *  - no error message leaks a table name, column name or SQL fragment —
 *    assert this over the whole taxonomy, not one example
 */
