/**
 * Tests for lib/services/progress.service.ts.
 *
 * Stories: SP-070, SP-071, SP-072, SP-073
 *
 * Cases
 *  - getDashboard returns level, latest score and plan completion per category
 *  - a brand-new student returns an empty but well-formed shape (SP-073)
 *  - overall completion matches the pure helper
 *  - getScoreTrend is oldest-first and includes only submitted assessments
 *  - one assessment -> a single point (the page shows the hint) (SP-071)
 */
