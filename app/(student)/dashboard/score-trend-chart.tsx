/**
 * Score trend for one category.
 *
 * Story: SP-071  (first on the cut list — see the backlog summary)
 *
 * Sketch
 *  - >=2 assessments -> simple line, x = submitted_at, y = total_score
 *  - exactly 1 -> a single point plus "take another to see progress"
 *  - 0 -> render nothing, the parent shows the empty state
 */
