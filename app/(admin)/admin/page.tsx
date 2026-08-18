/**
 * Admin overview.
 *
 * Layer: PAGE
 * Stories: SP-080, SP-081
 *
 * Sketch
 *  - tiles: total users, assessments completed, average score, most common
 *    weak category
 *  - the weak-category ranking is ONE SQL aggregate (stats.repo.ts). Pulling
 *    every row into JS to count is the failure mode SP-081 exists to prevent.
 */
