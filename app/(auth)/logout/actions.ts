/**
 * Logout server action.
 *
 * Layer: ACTION
 * Story: SP-010
 *
 * Sketch
 *  - supabase.auth.signOut(), clear cookies
 *  - revalidatePath('/', 'layout') so no RSC payload survives in the client cache
 *  - redirect('/login')
 *
 * Test: tests/app/(auth)/logout/actions.test.ts — asserts the Back-button case.
 */
