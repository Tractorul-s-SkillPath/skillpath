/**
 * Category actions.
 *
 * Layer: ACTION
 * Stories: SP-031, SP-032
 *
 * Sketch
 *  createCategory / updateCategory
 *   - assertAdmin, categorySchema.safeParse (2-60 chars — the SAME rule the DB
 *     check constraint enforces; Zod for the message, the constraint for the truth)
 *   - a unique violation from Postgres is caught and mapped to a field error.
 *     A 500 on a duplicate name is a bug (SP-031 AC2).
 *
 *  deactivateCategory  -- SP-032: status='inactive'. Hides it from student
 *   pickers, preserves existing assessments. Hard delete is refused by
 *   `on delete restrict`; we never expose one.
 *
 * Test: tests/app/(admin)/admin/categories/actions.test.ts
 */
