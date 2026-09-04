/**
 * Row -> domain object mapping.
 *
 * ARCHITECTURE §8: this happens in the repository layer and NOWHERE else. If a
 * component ever sees `first_name`, a repository skipped its job.
 *
 * IN THE DEFAULT RUN, NOT THE DATABASE ONE. Every function here is pure — a row
 * in, an object out, no client, no I/O. It sat in `exclude` next to the
 * `*.repo` integration tests because it lives in the same folder as them, which
 * is the one thing about it that has nothing to do with whether it needs a
 * database. It never did.
 *
 * The three cases worth having:
 *
 *  - `numeric` arrives from PostgREST as a JSON number OR as a string,
 *    depending on precision. Every score and average goes through `num()` for
 *    that reason, and a mapper that trusted the type would put "60.00" where a
 *    number belongs — where it renders fine and compares wrong.
 *  - `resultLevel` is derived, never stored, and must not be re-derived
 *    anywhere else.
 *  - answers are sorted by position here rather than left in join order,
 *    because without an ORDER BY the planner may reorder rows between two
 *    identical requests and shuffle A/B/C/D under the admin on a refresh.
 */

import { describe, expect, it } from 'vitest';
import {
    toAdminAnswer,
    toAdminOverview,
    toAdminQuestion,
    toAssessment,
    toCatalogCategory,
    toCategory,
    toCategoryRanking,
    toInterest,
    toManagedUser,
    toPlanItem,
    toProfile,
} from '../../../lib/repositories/mappers';
import { estimateLevel } from '../../../lib/domain/levels';
import type {
    AnswerRow,
    AssessmentRow,
    CategoryProgressRow,
    QuestionRow,
    RecommendationPlanRow,
    SkillCategoryRow,
    UserPublicRow,
} from '../../../lib/supabase/database.types';

const aUserRow = (overrides: Partial<UserPublicRow> = {}): UserPublicRow => ({
    user_id: '00000000-0000-4000-8000-000000000007',
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@skillpath.test',
    role: 'student',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
});

const aCategoryRow = (overrides: Partial<SkillCategoryRow> = {}): SkillCategoryRow => ({
    category_id: 3,
    name: 'Databases',
    description: 'Relational modelling.',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
});

const anAssessmentRow = (overrides: Partial<AssessmentRow> = {}): AssessmentRow => ({
    assessment_id: 42,
    user_id: '00000000-0000-4000-8000-000000000007',
    category_id: 3,
    session_id: null,
    requested_level: 'beginner',
    status: 'submitted',
    total_score: 60,
    time_limit_seconds: 600,
    created_at: '2026-01-01T00:00:00Z',
    started_at: '2026-01-01T00:00:00Z',
    submitted_at: '2026-01-01T00:10:00Z',
    ...overrides,
});

const anAnswerRow = (overrides: Partial<AnswerRow> = {}): AnswerRow => ({
    answer_id: 1,
    question_id: 10,
    answer_text: 'An option',
    is_correct: false,
    position: 0,
    ...overrides,
});

describe('toProfile', () => {
    it('renames every column into the domain shape', () => {
        const profile = toProfile(aUserRow());

        expect(profile).toEqual({
            userId: '00000000-0000-4000-8000-000000000007',
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'ada@skillpath.test',
            role: 'student',
            status: 'active',
            joinedAt: '2026-01-01T00:00:00Z',
        });
    });

    it('carries no snake_case key through', () => {
        // The rule the file header states, asserted directly: a component
        // seeing `first_name` means a repository skipped its job.
        const profile = toProfile(aUserRow());

        expect(Object.keys(profile).some((key) => key.includes('_'))).toBe(false);
    });
});

describe('toManagedUser', () => {
    it('drops the timestamps the admin table does not show', () => {
        expect(toManagedUser(aUserRow())).toEqual({
            userId: '00000000-0000-4000-8000-000000000007',
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'ada@skillpath.test',
            role: 'student',
            status: 'active',
        });
    });
});

describe('toCategory and toCatalogCategory', () => {
    it('maps the plain category', () => {
        expect(toCategory(aCategoryRow())).toEqual({
            categoryId: 3,
            name: 'Databases',
            description: 'Relational modelling.',
        });
    });

    it('keeps a null description null rather than turning it into a string', () => {
        // `SkillCategoryRow.description` is typed `string`, but the column is
        // nullable — a category created without one comes back null. The cast
        // is the mismatch, not a shortcut: database.types.ts is hand-written
        // (ARCHITECTURE §0), so it is the description of the schema most likely
        // to be slightly wrong, and this mapper has to survive being right.
        const row = aCategoryRow({ description: null as unknown as string });

        expect(toCategory(row).description).toBeNull();
    });

    it('adds the status and the count the catalog needs', () => {
        expect(toCatalogCategory(aCategoryRow(), 12)).toEqual({
            categoryId: 3,
            name: 'Databases',
            description: 'Relational modelling.',
            status: 'active',
            questionCount: 12,
        });
    });

    it('carries a count of zero through', () => {
        expect(toCatalogCategory(aCategoryRow(), 0).questionCount).toBe(0);
    });
});

describe('toAssessment', () => {
    it('derives the level from the score, using the shared rule', () => {
        // Imported, not inlined: estimateLevel's boundaries are the business
        // constant. A test hardcoding "advanced at 80" keeps passing after
        // somebody moves the boundary.
        const summary = toAssessment(anAssessmentRow({ total_score: 90 }), 'Databases');

        expect(summary.score).toBe(90);
        expect(summary.resultLevel).toBe(estimateLevel(90));
    });

    it('converts a numeric that arrived as a string', () => {
        // PostgREST sends `numeric` as a string at some precisions. Untouched,
        // "60.00" reaches the results page and every comparison against it is a
        // string comparison — "60.00" > 50 is false.
        const summary = toAssessment(
            anAssessmentRow({ total_score: '60.00' as unknown as number }),
            'Databases',
        );

        expect(summary.score).toBe(60);
        expect(typeof summary.score).toBe('number');
        expect(summary.resultLevel).toBe(estimateLevel(60));
    });

    it('leaves an in-progress run with a null score and a null level', () => {
        const summary = toAssessment(
            anAssessmentRow({ status: 'in_progress', total_score: null, submitted_at: null }),
            'Databases',
        );

        expect(summary.score).toBeNull();
        // Not 'beginner'. A run nobody has finished has no level, and printing
        // the lowest one would tell a member something untrue about themselves.
        expect(summary.resultLevel).toBeNull();
    });

    it('scores zero as 0, not as null', () => {
        // `row.total_score === null` rather than a falsy check, which is the
        // difference between "scored nothing" and "not scored".
        const summary = toAssessment(anAssessmentRow({ total_score: 0 }), 'Databases');

        expect(summary.score).toBe(0);
        expect(summary.resultLevel).toBe(estimateLevel(0));
    });

    it('takes the category name from its argument, not from the row', () => {
        expect(toAssessment(anAssessmentRow(), 'Unknown category').categoryName).toBe(
            'Unknown category',
        );
    });
});

describe('toInterest', () => {
    const aProgressRow = (overrides: Partial<CategoryProgressRow> = {}): CategoryProgressRow => ({
        progress_id: 1,
        user_id: '00000000-0000-4000-8000-000000000007',
        category_id: 3,
        current_level: 'intermediate',
        last_score: 72,
        last_assessed_at: '2026-01-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        ...overrides,
    });

    it('maps the row that IS the interest', () => {
        expect(toInterest(aProgressRow(), 'Databases')).toEqual({
            categoryId: 3,
            name: 'Databases',
            level: 'intermediate',
            lastScore: 72,
            assessedAt: '2026-01-01T00:00:00Z',
        });
    });

    it('keeps a never-assessed interest null rather than zero', () => {
        // A followed category nobody has been tested in must not read as 0% —
        // that is a real score, and a bad one.
        const interest = toInterest(
            aProgressRow({ last_score: null, last_assessed_at: null }),
            'Databases',
        );

        expect(interest.lastScore).toBeNull();
        expect(interest.assessedAt).toBeNull();
    });

    it('converts a string score to a number', () => {
        const interest = toInterest(
            aProgressRow({ last_score: '72.50' as unknown as number }),
            'Databases',
        );

        expect(interest.lastScore).toBe(72.5);
    });

    it('scores zero as 0', () => {
        expect(toInterest(aProgressRow({ last_score: 0 }), 'Databases').lastScore).toBe(0);
    });
});

describe('toAdminOverview and toCategoryRanking', () => {
    it('parses an average that arrived as a string', () => {
        const overview = toAdminOverview({
            total_users: 30,
            total_assessments: 19,
            average_score: '64.40' as unknown as number,
        });

        expect(overview.averageScore).toBe(64.4);
    });

    it('falls back to 0 for a null average on an empty database', () => {
        // The tiles must render on day one. `num()` coalescing null to 0 is
        // what stops "NaN%" on the admin home page.
        const overview = toAdminOverview({
            total_users: 0,
            total_assessments: 0,
            // Typed `number`, and `num()` coalesces null anyway — which is the
            // branch under test. The view is documented as returning a row on
            // an empty database via coalesce; this asserts the mapper does not
            // depend on that being true.
            average_score: null as unknown as number,
        });

        expect(overview.averageScore).toBe(0);
    });

    it('falls back to 0 rather than NaN for an unparseable average', () => {
        const overview = toAdminOverview({
            total_users: 1,
            total_assessments: 1,
            average_score: 'not a number' as unknown as number,
        });

        expect(overview.averageScore).toBe(0);
        expect(Number.isNaN(overview.averageScore)).toBe(false);
    });

    it('maps a category ranking row', () => {
        expect(
            toCategoryRanking({
                category_id: 3,
                category_name: 'Databases',
                assessments_count: 9,
                average_score: '41.5' as unknown as number,
            }),
        ).toEqual({
            categoryId: 3,
            name: 'Databases',
            assessmentCount: 9,
            averageScore: 41.5,
        });
    });
});

describe('toAdminAnswer and toAdminQuestion', () => {
    const aQuestionRow = (overrides: Partial<QuestionRow> = {}): QuestionRow => ({
        question_id: 10,
        category_id: 3,
        text: 'What does an index change?',
        difficulty: 'beginner',
        status: 'active',
        source: 'manual',
        created_by: '00000000-0000-4000-8000-000000000001',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        topic_title: 'Indexes',
        study_advice: 'Read the chapter.',
        ...overrides,
    });

    it('carries is_correct through as isCorrect — this shape is admin-only', () => {
        expect(toAdminAnswer(anAnswerRow({ is_correct: true }))).toEqual({
            answerId: 1,
            text: 'An option',
            isCorrect: true,
            position: 0,
        });
    });

    it('sorts the options by position rather than trusting join order', () => {
        const question = toAdminQuestion(aQuestionRow(), [
            anAnswerRow({ answer_id: 3, position: 2, answer_text: 'C' }),
            anAnswerRow({ answer_id: 1, position: 0, answer_text: 'A' }),
            anAnswerRow({ answer_id: 2, position: 1, answer_text: 'B' }),
        ]);

        expect(question.answers.map((a) => a.text)).toEqual(['A', 'B', 'C']);
    });

    it('does not reorder the array it was given', () => {
        // `[...answers].sort()`, not `answers.sort()`. The caller is iterating
        // the embed for several questions at once.
        const answers = [
            anAnswerRow({ answer_id: 2, position: 1 }),
            anAnswerRow({ answer_id: 1, position: 0 }),
        ];

        toAdminQuestion(aQuestionRow(), answers);

        expect(answers.map((a) => a.answer_id)).toEqual([2, 1]);
    });

    it('handles a question with no options at all', () => {
        expect(toAdminQuestion(aQuestionRow(), []).answers).toEqual([]);
    });
});

describe('toPlanItem', () => {
    const aPlanRow = (overrides: Partial<RecommendationPlanRow> = {}): RecommendationPlanRow => ({
        recommendation_id: 100,
        user_id: '00000000-0000-4000-8000-000000000007',
        category_id: 3,
        assessment_id: 42,
        topic_title: 'Indexes',
        rule_description: '  Revisit how an index changes a query plan.  ',
        ai_description: null,
        priority: 1,
        progress_status: 'not_started',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        completed_at: null,
        ...overrides,
    });

    it('trims the rule description', () => {
        expect(toPlanItem(aPlanRow(), 'Databases').description).toBe(
            'Revisit how an index changes a query plan.',
        );
    });

    it('turns a blank AI description into null rather than an empty card', () => {
        // `?.trim() || null`: a whitespace-only string is falsy after trimming,
        // so the page falls back to the rule description instead of rendering
        // an empty paragraph where the advice should be.
        expect(
            toPlanItem(aPlanRow({ ai_description: '   ' }), 'Databases').aiDescription,
        ).toBeNull();
        expect(
            toPlanItem(aPlanRow({ ai_description: null }), 'Databases').aiDescription,
        ).toBeNull();
    });

    it('keeps a real AI description, trimmed', () => {
        expect(
            toPlanItem(aPlanRow({ ai_description: '  Try the exercises.  ' }), 'Databases')
                .aiDescription,
        ).toBe('Try the exercises.');
    });

    it('maps the whole item', () => {
        expect(
            toPlanItem(
                aPlanRow({ progress_status: 'completed', completed_at: '2026-02-01T00:00:00Z' }),
                'Databases',
            ),
        ).toEqual({
            recommendationId: 100,
            categoryId: 3,
            categoryName: 'Databases',
            topicTitle: 'Indexes',
            description: 'Revisit how an index changes a query plan.',
            aiDescription: null,
            priority: 1,
            status: 'completed',
            completedAt: '2026-02-01T00:00:00Z',
        });
    });
});
