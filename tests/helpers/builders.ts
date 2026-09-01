/**
 * Domain object builders.
 *
 * Every builder returns a valid, boring instance and takes an override object,
 * so a test names only the field it is actually about:
 *
 *     aPlanItem({ status: 'completed' })
 *
 * The point is that a reader can tell which field drives the assertion. A test
 * that spells out all nine fields of a PlanItem hides its own subject.
 */

import type { UserPublicRow } from '../../lib/supabase/database.types';
import type { CurrentUser } from '../../lib/auth/current-user';
import type {
    AdminQuestion,
    AssessmentSummary,
    CatalogCategory,
    ManagedUser,
    Page,
    PlanItem,
    SkillCategory,
} from '../../lib/domain/types';

export const MEMBER_ID = 7;
export const ADMIN_ID = 1;

export function aCurrentUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
    return {
        userId: MEMBER_ID,
        email: 'member@test.com',
        role: 'student',
        status: 'active',
        // The row is only carried for display; nothing under test reads it.
        user: {} as UserPublicRow,
        ...overrides,
    };
}

export function anAdmin(overrides: Partial<CurrentUser> = {}): CurrentUser {
    return aCurrentUser({ userId: ADMIN_ID, email: 'admin@test.com', role: 'admin', ...overrides });
}

export function aPlanItem(overrides: Partial<PlanItem> = {}): PlanItem {
    return {
        recommendationId: 100,
        categoryId: 3,
        categoryName: 'Databases',
        topicTitle: 'Indexes',
        description: 'Revisit how an index changes a query plan.',
        aiDescription: null,
        priority: 1,
        status: 'not_started',
        completedAt: null,
        ...overrides,
    };
}

export function aCategory(overrides: Partial<SkillCategory> = {}): SkillCategory {
    return {
        categoryId: 3,
        name: 'Databases',
        description: 'Relational modelling and query performance.',
        ...overrides,
    };
}

export function aCatalogCategory(overrides: Partial<CatalogCategory> = {}): CatalogCategory {
    return {
        categoryId: 3,
        name: 'Databases',
        description: 'Relational modelling and query performance.',
        status: 'active',
        questionCount: 12,
        ...overrides,
    };
}

export function anAssessment(overrides: Partial<AssessmentSummary> = {}): AssessmentSummary {
    return {
        assessmentId: 500,
        categoryId: 3,
        categoryName: 'Databases',
        status: 'submitted',
        score: 72,
        resultLevel: 'intermediate',
        createdAt: '2026-06-01T10:00:00.000Z',
        submittedAt: '2026-06-01T10:20:00.000Z',
        ...overrides,
    };
}

export function aManagedUser(overrides: Partial<ManagedUser> = {}): ManagedUser {
    return {
        userId: MEMBER_ID,
        firstName: 'Ion',
        lastName: 'Popescu',
        email: 'member@test.com',
        role: 'student',
        status: 'active',
        ...overrides,
    };
}

export function anAdminQuestion(overrides: Partial<AdminQuestion> = {}): AdminQuestion {
    return {
        questionId: 900,
        categoryId: 3,
        text: 'What does an index cost on write?',
        difficulty: 'intermediate',
        status: 'active',
        answers: [
            { answerId: 1, text: 'Nothing', isCorrect: false, position: 1 },
            { answerId: 2, text: 'Extra work per insert', isCorrect: true, position: 2 },
        ],
        ...overrides,
    };
}

export function aPage<T>(items: T[], overrides: Partial<Page<T>> = {}): Page<T> {
    return {
        items,
        total: items.length,
        page: 1,
        pageSize: 10,
        totalPages: 1,
        ...overrides,
    };
}
