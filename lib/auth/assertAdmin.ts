/**
 * assertAdmin() — the third authorization layer (§5c).
 *
 * Stories: SP-012, SP-037
 *
 * Sketch: assertAuth, then require role='admin' AND status='active'; otherwise
 * a 403 AppError. Mirrors the SQL is_admin() exactly — if one changes, both change.
 *
 * This exists for the two things RLS structurally cannot do: guarding
 * service-role writes to the question bank, and guarding admin aggregates.
 * It is not a substitute for a policy anywhere a policy would work.
 *
 * Test: tests/lib/auth/assertAdmin.test.ts
 */
