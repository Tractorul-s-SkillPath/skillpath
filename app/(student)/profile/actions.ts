/**
 * Profile server actions.
 *
 * Layer: ACTION
 * Stories: SP-021, SP-022
 *
 * Sketch
 *  updateProfile(prevState, formData)
 *   - assertAuth() — the user id comes from auth.uid(), NEVER from the form (§5)
 *   - profileSchema.safeParse (name lengths, objective max length, interest ids)
 *   - profile.service.update() -> revalidatePath('/profile') and the layout
 *     so the header name updates (SP-021 AC1)
 *
 * Test: tests/app/(student)/profile/actions.test.ts
 */
