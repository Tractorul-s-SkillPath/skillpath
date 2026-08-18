/**
 * Domain types — camelCase, database-shaped only where it helps.
 *
 * This file and the migrations are the two places three people edit at once
 * (§9). Keep it alphabetical, keep it boring, review changes together.
 *
 * Sketch
 *  SkillLevel, UserRole, UserStatus, ContentStatus, AssessmentStatus, PlanStatus
 *  CategoryId = number (branded), UserId = string
 *  Question, AnswerOption (NO is_correct — that shape is admin-only),
 *  Answer (admin, WITH isCorrect), Response, Assessment, ScoreResult,
 *  CategoryScore, PlanItem, CategoryProgress
 *
 * The AnswerOption / Answer split is deliberate: the type a student page can
 * receive has no correctness field, so leaking it needs a deliberate cast.
 */
