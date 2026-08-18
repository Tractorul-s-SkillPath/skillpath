/**
 * Results page.
 *
 * Layer: PAGE
 * Stories: SP-053, SP-051, SP-052
 *
 * Sketch
 *  - total score, per-category score, estimated level, weak areas
 *  - per-question review: your answer, the correct one, correct/incorrect —
 *    this is the one place is_correct is legitimately shown, and only AFTER
 *    submission, server-rendered
 *  - another student's id -> notFound(), because RLS returned nothing (SP-053 AC2)
 *  - session_id set -> group the sibling assessments (SP-048)
 */
