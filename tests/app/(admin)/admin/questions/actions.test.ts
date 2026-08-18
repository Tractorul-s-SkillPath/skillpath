/**
 * Tests for app/(admin)/admin/questions/actions.ts.
 *
 * Stories: SP-034, SP-035, SP-036, SP-037
 *
 * Cases
 *  - a student calling the action directly -> 403 and ZERO writes (SP-037 AC2)
 *  - zero correct answers -> form-level error before any service call
 *  - 7 options -> rejected
 *  - a created question defaults to status='inactive' (SP-034 AC3)
 *  - activating a question with no correct answer -> refused (SP-036)
 *  - the success path revalidates the question list
 */
