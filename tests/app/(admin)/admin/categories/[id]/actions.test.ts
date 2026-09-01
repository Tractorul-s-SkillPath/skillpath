/**
 * Tests for app/(admin)/admin/categories/[id]/actions.ts.
 *
 * Stories: SP-033, SP-034, SP-035, SP-036
 *
 * The action's own header names this file as its test, and it did not exist —
 * the only mirror under admin/categories covered the category list action, not
 * the per-category question actions.
 *
 * THE BUG THIS FILE EXISTS TO CATCH IS ALREADY DOCUMENTED IN THE SOURCE.
 * An earlier version built options as `is_correct` (the database spelling) and
 * silenced the compiler with `createQuestion(data as any)`. The repository
 * reads `answer.isCorrect`, so every option was written with an undefined
 * answer key: the questions saved successfully and not one of them was
 * answerable. A test that asserts the shape reaching the service is what would
 * have caught it, so make that the first case written here.
 *
 * Cases
 *  - a non-admin -> refused before any service call
 *  - options reach the service as `isCorrect`, not `is_correct`
 *  - a question with no correct option -> rejected at the schema (SP-034)
 *  - more than ANSWERS_MAX options -> rejected at the schema
 *  - blank question text -> field errors, no write
 *  - success -> revalidatePath for the category page, then redirect
 *  - a failed service call -> one message, no redirect
 *  - the categoryId comes from the route, never the form body
 */
