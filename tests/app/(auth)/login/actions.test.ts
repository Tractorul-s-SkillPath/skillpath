/**
 * Tests for app/(auth)/login/actions.ts.
 *
 * Stories: SP-010, SP-014
 *
 * The action contract, asserted the same way in every actions test:
 *   guard -> parse -> service -> revalidate -> redirect
 *
 * Cases
 *  - invalid form data -> field errors returned, the service is NEVER called
 *  - valid data -> the service is called with the parsed values
 *  - success -> revalidatePath + redirect to ?next, or /dashboard
 *  - a `next` pointing at another origin is ignored (open-redirect guard)
 *  - failure -> one generic message, and no redirect (SP-010 AC2)
 *  - inactive account -> "account disabled" (SP-014)
 */
