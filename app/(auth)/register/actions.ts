/**
 * Registration server action.
 *
 * Layer: ACTION
 * Story: SP-011
 *
 * Sketch
 *  - registerSchema.safeParse
 *  - auth.service.register(): supabase.auth.signUp with
 *    options.data = { first_name, last_name } so the handle_new_user() trigger
 *    can copy them out of raw_user_meta_data into profiles
 *  - the profiles row is created BY THE TRIGGER, not by this action. If you
 *    find yourself inserting into profiles here, migration 0001 is wrong.
 *  - duplicate email -> field error, no rows created
 *
 * Test: tests/app/(auth)/register/actions.test.ts
 */
