/**
 * Domain types — camelCase, no database vocabulary.
 *
 * Repositories map rows into these and nothing else does (§8). A component
 * receiving one of these cannot tell which table it came from.
 */

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * Underscores, matching the `plan_status` enum in 0001_init.sql.
 *
 * This used to be `'not started' | 'in progress' | 'completed'` — with spaces —
 * because the hand-made table had a CHECK constraint written that way, and
 * three files carried a comment warning that an underscore would fail at
 * runtime rather than at compile time. The restructure made it a real enum.
 */
export type PlanStatus = 'not_started' | 'in_progress' | 'completed';

/** Mirrors the `assessment_status` enum. `abandoned` is now expressible. */
export type AssessmentStatus = 'in_progress' | 'submitted' | 'abandoned';

export interface StudentProfile {
    userId: number;
    firstName: string;
    lastName: string;
    email: string;
    role: 'student' | 'admin';
    status: string;
    joinedAt: string;
}

export interface SkillCategory {
    categoryId: number;
    name: string;
    description: string;
}

/**
 * A category the member follows.
 *
 * A category_progress row IS the interest — following a category and having a
 * level in it are the same fact. `lastScore` and `assessedAt` now come from
 * that same row: the grading trigger writes them when an assessment is
 * submitted, so reading a member's latest score no longer means pulling their
 * whole assessment history and picking the newest per category in JavaScript.
 */
export interface Interest {
    categoryId: number;
    name: string;
    level: SkillLevel;
    lastScore: number | null;
    assessedAt: string | null;
}

export interface AssessmentSummary {
    assessmentId: number;
    categoryId: number;
    categoryName: string;
    /** A real column now, not an inference from `total_score IS NULL`. */
    status: AssessmentStatus;
    score: number | null;
    resultLevel: SkillLevel | null;
    createdAt: string;
    submittedAt: string | null;
}

export interface PlanItem {
    recommendationId: number;
    categoryId: number;
    categoryName: string;
    topicTitle: string;
    /** Rule-based text. Always present, renders with AI off or failing. */
    description: string;
    /** AI elaboration, when a provider produced one. Decoration only. */
    aiDescription: string | null;
    /** 1 is most urgent. */
    priority: number;
    status: PlanStatus;
    completedAt: string | null;
}

export interface Badge {
    badgeId: number;
    code: string;
    name: string;
    description: string;
    icon: string;
    earned: boolean;
    /**
     * When it was earned. Real for every earned badge now: the award is an
     * `xp_events` row and that row carries `awarded_at`. Before the ledger
     * existed this was null for any badge whose rule had no dated event
     * behind it, which was most of them.
     */
    earnedAt: string | null;
}

export interface Quest {
    questId: number;
    code: string;
    name: string;
    description: string;
    icon: string;
    targetCount: number;
    xpReward: number;
    progressCount: number;
    completedAt: string | null;
}

export interface LeaderboardEntry {
    rank: number;
    displayName: string;
    xp: number;
    isYou: boolean;
}

export interface MyRank {
    rank: number;
    xp: number;
    totalMembers: number;
}

/** One line of "why do I have 312 XP". Read straight from the ledger. */
export interface XpEntry {
    amount: number;
    reason: string;
    awardedAt: string;
}

// -----------------------------------------------------------------------------
// Admin
//
// The admin surfaces read the same tables as the student ones but need shapes a
// student may never see: every member rather than yourself, and — in
// AdminAnswer — which option is the correct one.
// -----------------------------------------------------------------------------

/** The four tiles at the top of /admin. */
export interface AdminOverview {
    totalUsers: number;
    totalAssessments: number;
    averageScore: number;
}

/** One row of the weakest-areas ranking. */
export interface CategoryRanking {
    categoryId: number;
    name: string;
    assessmentCount: number;
    averageScore: number;
}

/** A member as the user-management table sees them. */
export interface ManagedUser {
    userId: number;
    firstName: string;
    lastName: string;
    email: string;
    role: 'student' | 'admin';
    status: 'active' | 'inactive';
}

/** A catalog row for the admin, which unlike the student picker shows inactive ones. */
export interface CatalogCategory {
    categoryId: number;
    name: string;
    description: string;
    status: 'active' | 'inactive';
    questionCount: number;
}

/**
 * An option with its key attached.
 *
 * ARCHITECTURE §5 "the is_correct problem": this is the ONE shape that carries
 * `isCorrect`, and nothing student-facing may be handed one. The student side
 * gets `AnswerOptionRow`, which is the same row with that field removed.
 */
export interface AdminAnswer {
    answerId: number;
    text: string;
    isCorrect: boolean;
    position: number;
}

export interface AdminQuestion {
    questionId: number;
    categoryId: number;
    text: string;
    difficulty: SkillLevel;
    status: 'active' | 'inactive';
    answers: AdminAnswer[];
}

/** A submitted assessment, as the cross-platform results table lists it. */
export interface AdminResult {
    assessmentId: number;
    studentName: string;
    email: string;
    categoryName: string;
    score: number;
    /** Derived from the score by lib/domain/levels.ts. Never stored. */
    level: SkillLevel;
    submittedAt: string;
}

/**
 * One page of a server-side paged list.
 *
 * `total` is the count of matching rows, not of returned ones — pagination
 * controls need to know how many pages exist, and asking a second time for a
 * count the first query already had is a wasted round trip.
 */
export interface Page<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

/** Everything the profile page renders. */
export interface ProfileDashboard {
    profile: StudentProfile;
    interests: Interest[];
    catalog: SkillCategory[];
    assessments: AssessmentSummary[];
    plan: PlanItem[];

    /** Summed from the xp_events ledger, not recomputed from scratch. */
    xp: number;
    /** From current_streak() — consecutive days of any XP activity. */
    streak: number;
    lastActiveOn: string | null;
    overallLevel: SkillLevel | null;
    badges: Badge[];
    quests: Quest[];
    leaderboard: LeaderboardEntry[];
    myRank: MyRank | null;
}
