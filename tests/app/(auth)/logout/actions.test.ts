/**
 * Tests for app/(auth)/logout/actions.ts.
 *
 * Story: SP-010
 *
 * Cases
 *  - signOut is called and the auth cookies are cleared
 *  - revalidatePath('/', 'layout') runs, so no cached RSC payload survives
 *  - redirect to /login
 *  - calling it while already logged out is a no-op, not an error
 */
