/**
 * RLS: student_responses.
 *
 * Stories: SP-004, SP-043
 *
 * Cases
 *  - a student reads the responses of their own assessment
 *  - and gets 0 rows for someone else's assessment (the policy goes through
 *    exists(assessment owned by auth.uid()))
 *  - a student can update selected_answer_id on their own in-progress response
 *  - a student CANNOT write is_correct — grading is service-role only
 *  - a student cannot update a response on a submitted assessment
 */
