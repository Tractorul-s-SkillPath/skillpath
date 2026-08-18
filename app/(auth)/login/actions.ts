/**
 * Login / logout server actions.
 *
 * Layer: ACTION — assertAuth -> zod.parse -> service -> revalidate -> redirect. ~15 lines. (§3)
 * Stories: SP-010, SP-014
 *
 * Sketch
 *  login(prevState, formData)
 *   - loginSchema.safeParse -> field errors back to the form on failure
 *   - auth.service.login() -> Result<Session, AppError>
 *   - inactive account -> "account disabled" (SP-014), same shape as a bad password
 *   - success -> revalidatePath('/', 'layout') then redirect(next ?? '/dashboard')
 *
 * A Server Action is a public HTTP endpoint. Nothing reaches the service unparsed.
 *
 * Test: tests/app/(auth)/login/actions.test.ts
 */
