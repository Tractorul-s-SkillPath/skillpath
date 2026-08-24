/**
 * Rows -> domain objects.
 *
 * ARCHITECTURE §8: this mapping happens in the repository layer and NOWHERE
 * else. If a component ever sees `first_name`, a repository skipped its job.
 *
 * Test: tests/lib/repositories/mappers.test.ts
 */

import type {
    AdminOverviewRow,
    AnswerRow,
    AssessmentRow,
    CategoryProgressRow,
    CategoryScoreSummaryRow,
    QuestionRow,
    RecommendationPlanRow,
    SkillCategoryRow,
    UserPublicRow,
} from '../supabase/database.types';
import { estimateLevel } from '../domain/levels';
import type {
    AdminAnswer,
    AdminOverview,
    AdminQuestion,
    AssessmentSummary,
    CatalogCategory,
    CategoryRanking,
    Interest,
    ManagedUser,
    PlanItem,
    SkillCategory,
    StudentProfile,
} from '../domain/types';

/**
 * The member's own row.
 *
 * Takes `UserPublicRow`, which is `users` minus `password` — so a caller that
 * did `select('*')` cannot pass its result in here without noticing.
 */
export function toProfile(user: UserPublicRow): StudentProfile {
    return {
        userId: user.user_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        status: user.status,
        joinedAt: user.created_at,
    };
}

export function toCategory(row: SkillCategoryRow): SkillCategory {
    return {
        categoryId: row.category_id,
        name: row.name,
        description: row.description,
    };
}

/**
 * An interest, from the `category_progress` row that is the interest.
 *
 * `last_score` and `last_assessed_at` are columns now, written by the grading
 * trigger. The profile page used to get this by fetching every scored
 * assessment the member had ever taken and picking the newest per category in
 * JavaScript.
 */
export function toInterest(row: CategoryProgressRow, categoryName: string): Interest {
    return {
        categoryId: row.category_id,
        name: categoryName,
        level: row.current_level,
        lastScore: row.last_score === null ? null : Number(row.last_score),
        assessedAt: row.last_assessed_at,
    };
}

export function toAssessment(row: AssessmentRow, categoryName: string): AssessmentSummary {
    const score = row.total_score === null ? null : Number(row.total_score);

    return {
        assessmentId: row.assessment_id,
        categoryId: row.category_id,
        categoryName,
        status: row.status,
        score,
        // Derived, never stored twice: what a score *means* is a display rule.
        //
        // The level written to category_progress comes from level_for_score()
        // in SQL. estimateLevel() must use the same boundaries — 50 and 80 —
        // and nothing currently checks that it does. See the note in
        // lib/domain/constants.ts.
        resultLevel: score === null ? null : estimateLevel(score),
        createdAt: row.created_at,
        submittedAt: row.submitted_at,
    };
}

// -----------------------------------------------------------------------------
// Admin
// -----------------------------------------------------------------------------

/**
 * `numeric` columns arrive from PostgREST as a JSON number or as a string
 * depending on precision, so every average and every score goes through here
 * rather than being trusted to already be a number. `toAssessment` above does
 * the same for `total_score`.
 */
function num(value: number | string | null): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function toAdminOverview(row: AdminOverviewRow): AdminOverview {
    return {
        totalUsers: row.total_users,
        totalAssessments: row.total_assessments,
        averageScore: num(row.average_score),
    };
}

export function toCategoryRanking(row: CategoryScoreSummaryRow): CategoryRanking {
    return {
        categoryId: row.category_id,
        name: row.category_name,
        assessmentCount: row.assessments_count,
        averageScore: num(row.average_score),
    };
}

export function toManagedUser(user: UserPublicRow): ManagedUser {
    return {
        userId: user.user_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        status: user.status,
    };
}

export function toCatalogCategory(row: SkillCategoryRow, questionCount: number): CatalogCategory {
    return {
        categoryId: row.category_id,
        name: row.name,
        description: row.description,
        status: row.status,
        questionCount,
    };
}

export function toAdminAnswer(row: AnswerRow): AdminAnswer {
    return {
        answerId: row.answer_id,
        text: row.answer_text,
        isCorrect: row.is_correct,
        position: row.position,
    };
}

/**
 * A question with its answer key.
 *
 * Options are sorted by `position` here rather than left in whatever order the
 * join returned them. Without an ORDER BY the planner is free to reorder rows
 * between two identical requests, which would shuffle A/B/C/D under the admin
 * on a plain refresh.
 */
export function toAdminQuestion(row: QuestionRow, answers: AnswerRow[]): AdminQuestion {
    return {
        questionId: row.question_id,
        categoryId: row.category_id,
        text: row.text,
        difficulty: row.difficulty,
        status: row.status,
        answers: [...answers].sort((a, b) => a.position - b.position).map(toAdminAnswer),
    };
}

export function toPlanItem(row: RecommendationPlanRow, categoryName: string): PlanItem {
    return {
        recommendationId: row.recommendation_id,
        categoryId: row.category_id,
        categoryName,
        topicTitle: row.topic_title,
        description: row.rule_description.trim(),
        aiDescription: row.ai_description?.trim() || null,
        priority: row.priority,
        status: row.progress_status,
        completedAt: row.completed_at,
    };
}
