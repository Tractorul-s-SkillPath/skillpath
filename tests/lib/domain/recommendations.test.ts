/**
 * Tests for lib/domain/recommendations.ts.
 *
 * Stories: SP-060, SP-064, SP-065
 *
 * Cases
 *  - DETERMINISM: identical input run twice -> deeply equal output (SP-060 AC2)
 *  - every item has a non-empty rule_description and a priority in 1-5
 *  - the worst category gets priority 1
 *  - no weak areas -> the "you're solid, try the next level" item, not [] (SP-064)
 *  - the item count is bounded — a student with six weak areas does not get a
 *    30-item plan they will never read
 *  - no ai_description is ever produced here (D5: rules decide, AI decorates)
 */
