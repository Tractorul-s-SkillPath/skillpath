/**
 * Draft review — human in the loop.
 *
 * Story: SP-092
 *
 * Sketch
 *  - each draft is fully editable before it is accepted
 *  - accept = activate (status='active'), reject = delete. Both are just status
 *    changes on the existing schema — no new table.
 *  - drafts stay source='ai' forever, so the dashboard can show what the model
 *    wrote (cheap, good demo material)
 */
