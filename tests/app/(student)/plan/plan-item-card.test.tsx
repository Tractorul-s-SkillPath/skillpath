/**
 * RTL tests for app/(student)/plan/plan-item-card.tsx.
 *
 * Stories: SP-062, SP-063, SP-091
 *
 * Cases
 *  - rule_description always renders
 *  - ai_description renders when present and the card is unchanged when it is
 *    null — no empty box, no "AI unavailable" banner (SP-091 AC3)
 *  - the status control moves not started -> in progress -> completed
 *  - the control is disabled while the update is pending
 */
