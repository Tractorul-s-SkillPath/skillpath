/**
 * RLS: questions, answers, and the answer_options view. The headline security test.
 *
 * Stories: SP-004, SP-037, SP-038
 *
 * Cases
 *  - GET /rest/v1/answers?select=is_correct with a student token -> 401/empty.
 *    THIS is the test that proves the answer key does not leak (SP-004 AC2)
 *  - the same with an admin token -> also refused: the revoke is total, which is
 *    the trade-off we accepted in §5 and must be able to demonstrate
 *  - a student selecting answer_options gets answer_text and NO is_correct column
 *    (SP-004 AC3)
 *  - a student sees active questions only
 *  - a student cannot insert or update a question or an answer
 *  - the service-role client can read and write both tables (that is the only path)
 */
