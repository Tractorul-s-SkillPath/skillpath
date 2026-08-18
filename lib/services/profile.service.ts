/**
 * Profile reads and writes.
 *
 * Layer: SERVICE
 * Stories: SP-020, SP-021, SP-022, SP-023
 *
 * Sketch
 *  getProfile(userId)      - profile + per-category level + interests
 *  updateProfile(userId, input) - names, interests, objective ONLY
 *  getAssessmentHistory(userId) - newest first, abandoned excluded
 *
 * role and status are not parameters of updateProfile. They are not omitted by
 * politeness — the 0002 trigger reverts them anyway (SP-013) — but a function
 * that cannot express the mistake is better than one that relies on the net.
 *
 * Test: tests/lib/services/profile.service.test.ts
 */
