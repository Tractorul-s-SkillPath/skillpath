/**
 * Per-question review list.
 *
 * Stories: SP-053, SP-035
 *
 * Sketch
 *  - reads the STORED is_correct snapshot on each response, not a recomputation.
 *    If an admin later fixes the answer key, this page must still show what the
 *    student was actually graded on — that is the D4 guarantee.
 *  - unanswered rows render as "not answered — counted incorrect"
 */
