/**
 * Migration 0001 invariants — the bugs we never have to test for elsewhere (§4.1).
 *
 * Story: SP-003
 *
 * Cases
 *  - a second correct answer on one question -> rejected
 *    (answers_one_correct_per_question) (SP-003 AC2)
 *  - a second in_progress assessment for the same (user, category) -> rejected
 *    (one_active_assessment_per_user_category)
 *  - a different category for the same user -> allowed
 *  - status='submitted' with a null total_score -> rejected
 *    (assessment_score_present) (SP-003 AC3)
 *  - status='in_progress' WITH a score -> also rejected (the check is an equality)
 *  - total_score of 101 or -1 -> rejected
 *  - duplicate (assessment_id, question_id) and (assessment_id, position) -> rejected
 *  - duplicate (user_id, category_id) in category_progress -> rejected
 *  - a category name of 1 char or 61 chars -> rejected
 *  - deleting a category that has questions -> refused (on delete restrict)
 *  - deleting a user -> their assessments cascade away
 *  - all 6 enums exist with exactly the documented values
 */
