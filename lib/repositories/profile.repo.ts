/**
 * profiles table.
 *
 * Layer: REPOSITORY
 * Stories: SP-011, SP-013, SP-020, SP-021, SP-083
 *
 * Sketch: findByUserId, updateEditableFields, search(filters), setStatus.
 * User-scoped reads use the SERVER (anon + cookie) client so RLS applies;
 * admin search uses the admin client behind assertAdmin().
 *
 * Test: tests/lib/repositories/profile.repo.test.ts (integration)
 */
