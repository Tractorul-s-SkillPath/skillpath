/**
 * Integration tests for lib/repositories/profile.repo.ts.
 * Needs a Supabase test project. Excluded from the coverage gate.
 *
 * Cases
 *  - findByUserId returns the row created by the handle_new_user trigger
 *  - updateEditableFields persists names
 *  - the same update with role='admin' leaves role unchanged (SP-013 through
 *    the repository, in addition to the raw SQL test in tests/db)
 *  - search matches partial name and email
 *  - a failing query returns an error — it never returns [] (§10 risk 1)
 */
