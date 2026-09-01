/**
 * Tests for app/(admin)/admin/account/actions.ts.
 *
 * Stories: SP-014, SP-030
 *
 * The action contract, asserted the same way in every actions test:
 *   guard -> parse -> service -> revalidate
 *
 * This is a deliberate near-duplicate of the student rename action, and the
 * difference is the point: the guard is assertAdmin rather than assertAuth, and
 * it revalidates /admin/account rather than /profile. Testing it as though it
 * were the same action would miss the only thing that distinguishes them.
 *
 * Cases
 *  - a signed-in non-admin -> refused by assertAdmin, service never called
 *  - a blank or over-long name -> field errors returned, service never called
 *  - valid input -> the service is called with the id from the SESSION, never
 *    from the form (a crafted POST must not rename another user)
 *  - success -> revalidatePath('/admin/account'), and NOT '/profile'
 *  - a failed service call -> the error surfaces as a message, not a crash
 */
