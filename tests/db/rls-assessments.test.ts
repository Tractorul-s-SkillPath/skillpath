/**
 * RLS: assessments.
 *
 * Stories: SP-004, SP-053
 *
 * Cases
 *  - a student selects their own assessments -> their rows
 *  - student X selecting student Y's assessments -> 0 rows (SP-004 AC4).
 *    This is also what makes SP-053's 404 real rather than an `if`.
 *  - a student can insert an assessment for THEMSELVES only; a forged user_id
 *    is rejected by the with-check policy
 *  - a student cannot update another student's assessment
 *  - an admin selects all
 */
