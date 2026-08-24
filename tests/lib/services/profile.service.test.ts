/**
 * Tests for lib/services/profile.service.ts.
 *
 * Stories: SP-020, SP-021, SP-022, SP-023
 *
 * Cases
 *  - getProfile returns levels per category and interests
 *  - a student with no assessments -> a well-formed empty shape, not an error
 *  - updateProfile writes names, interests and objective
 *  - updateProfile ignores role/status even if they are smuggled into the object
 *  - getAssessmentHistory is newest-first and excludes abandoned runs
 */
