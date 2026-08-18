/**
 * Skill category catalog.
 *
 * Layer: SERVICE
 * Stories: SP-030, SP-031, SP-032, SP-040
 *
 * Sketch
 *  listCategories({ page, pageSize, search })  - admin, with question counts
 *  listSelectableCategories(userId)            - student picker: active AND
 *    having >= MIN eligible questions; each carries the student's current level
 *  createCategory / updateCategory  - assertAdmin; unique violation -> 'conflict'
 *  deactivateCategory               - never a hard delete
 *
 * Test: tests/lib/services/category.service.test.ts
 */
