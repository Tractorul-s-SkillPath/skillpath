/**
 * Plan generation rules — pure and deterministic.
 *
 * Stories: SP-060, SP-064, SP-065
 *
 * Sketch
 *  buildPlan(weakAreas, level, catalog): PlanItem[]
 *   - each item: topicTitle, ruleDescription (ALWAYS set), priority 1-5
 *   - ai_description is not this function's business. Rules decide, AI decorates (D5).
 *   - same input twice -> byte-identical output. No Date.now(), no Math.random(),
 *     no Set/Map iteration order dependence (SP-060 AC2)
 *   - no weak areas -> the "you're solid, try the next level" item, never []
 *     that renders as a blank page (SP-064)
 *
 * Test: tests/lib/domain/recommendations.test.ts
 */
