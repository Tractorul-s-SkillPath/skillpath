/**
 * Database types — the TypeScript side of supabase/migrations.
 *
 * Still hand-written, because the project is not linked to the Supabase CLI and
 * `supabase gen types` therefore has nothing to point at. That makes this file
 * a contract with a human on the other end of it: **a migration and this file
 * change in the same commit, or the app compiles and then fails at runtime.**
 * Wiring up type generation is the fix; until then, this.
 *
 * Row shapes are `type`, never `interface`: interfaces get no implicit index
 * signature, so supabase-js resolves the whole table to `never` and every
 * property access fails with a very confusing error.
 */

// -----------------------------------------------------------------------------
// Enums — each one is a Postgres enum in 0001_init.sql, not a CHECK on text.
// -----------------------------------------------------------------------------

export type UserRole = 'student' | 'admin';
export type UserStatus = 'active' | 'inactive';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
export type ContentStatus = 'active' | 'inactive';
export type AssessmentStatus = 'in_progress' | 'submitted' | 'abandoned';
export type QuestionSource = 'manual' | 'ai';

/**
 * Underscores. The old hand-made schema used `('not started', 'in progress',
 * 'completed')` — with spaces — and every layer carried a comment warning about
 * it. 0001_init.sql makes it a proper enum.
 */
export type PlanStatus = 'not_started' | 'in_progress' | 'completed';

export type XpReason =
    | 'assessment_submitted'
    | 'assessment_score'
    | 'plan_item_completed'
    | 'badge_earned'
    | 'quest_completed';

// -----------------------------------------------------------------------------
// Rows
// -----------------------------------------------------------------------------

export type UserRow = {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    /**
     * Present, NOT NULL, and read by nothing: sign-in is by email alone, by
     * team decision. See the header of lib/auth/current-user.ts.
     *
     * Never `select('*')` from `users` in a path that reaches a component —
     * ask for the columns you need. UserPublicRow below is the safe shape.
     */
    password: string;
    role: UserRole;
    status: UserStatus;
    created_at: string;
    updated_at: string;
};

/** `users` without the password column. What every read path should ask for. */
export type UserPublicRow = Omit<UserRow, 'password'>;

export const USER_PUBLIC_COLUMNS =
    'user_id, first_name, last_name, email, role, status, created_at, updated_at' as const;

export type SkillCategoryRow = {
    category_id: number;
    name: string;
    description: string;
    status: ContentStatus;
    created_at: string;
    updated_at: string;
};

export type QuestionRow = {
    question_id: number;
    category_id: number;
    text: string;
    difficulty: SkillLevel;
    status: ContentStatus;
    source: QuestionSource;
    created_by: number | null;
    /**
     * What this question probes, and what to study when it is missed (0004).
     *
     * Nullable, and every question outside the baseline paper has neither yet:
     * a question with no topic produces no recommendation, which is fewer
     * recommendations rather than wrong ones. The admin question form does not
     * write these yet — the baseline's twenty come from the 0004 backfill.
     */
    topic_title: string | null;
    study_advice: string | null;
    created_at: string;
    updated_at: string;
};

export type AnswerRow = {
    answer_id: number;
    question_id: number;
    answer_text: string;
    is_correct: boolean;
    position: number;
};

/** `answers` without the key. The only shape a student may ever be handed. */
export type AnswerOptionRow = Omit<AnswerRow, 'is_correct'>;

export type AssessmentRow = {
    assessment_id: number;
    user_id: number;
    category_id: number;
    session_id: string | null;
    requested_level: SkillLevel;
    /** Real column now. `total_score IS NULL` is no longer a status. */
    status: AssessmentStatus;
    total_score: number | null;
    time_limit_seconds: number | null;
    created_at: string;
    started_at: string | null;
    submitted_at: string | null;
};

export type StudentResponseRow = {
    student_response_id: number;
    assessment_id: number;
    question_id: number;
    selected_answer_id: number | null;
    /** Stable question order, so a refresh re-reads the identical paper. */
    position: number;
    /** Snapshot written at grading time. Null until then. */
    is_correct: boolean | null;
    answered_at: string | null;
};

export type CategoryProgressRow = {
    progress_id: number;
    user_id: number;
    category_id: number;
    current_level: SkillLevel;
    last_score: number | null;
    last_assessed_at: string | null;
    created_at: string;
    updated_at: string;
};

export type RecommendationPlanRow = {
    recommendation_id: number;
    user_id: number;
    category_id: number;
    assessment_id: number | null;
    topic_title: string;
    /** Always set. The plan renders correctly with AI disabled or failing. */
    rule_description: string;
    /** Decoration on top of rule_description, never a replacement for it. */
    ai_description: string | null;
    priority: number;
    progress_status: PlanStatus;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
};

/**
 * The XP ledger. Append-only: rows are inserted, never updated or deleted, so a
 * total is a SUM and a history is a scan.
 *
 * Most rows are written by the triggers in 0002 rather than by the application.
 * The exception is `badge_earned`, which the profile service inserts once a
 * pure rule in lib/domain/derived.ts says a badge has been earned.
 */
export type XpEventRow = {
    xp_event_id: number;
    user_id: number;
    amount: number;
    reason: XpReason;
    assessment_id: number | null;
    recommendation_id: number | null;
    /** Badge or quest code. Null for assessment and plan awards. */
    code: string | null;
    /** The date the award counts for, in Europe/Bucharest. Streaks group by it. */
    awarded_on: string;
    awarded_at: string;
};

// -----------------------------------------------------------------------------
// Views
// -----------------------------------------------------------------------------

export type UserXpTotalRow = {
    user_id: number;
    total_xp: number;
};

export type LeaderboardRow = {
    user_id: number;
    display_name: string;
    total_xp: number;
    rank: number;
};

/**
 * `admin_overview` (0003). Exactly one row, on an empty database too — the view
 * coalesces, so a repository can `.single()` it without a special case.
 *
 * `average_score` is `numeric`, which PostgREST may serialise as a string.
 * Mappers run it through `Number()` for the same reason they do for
 * `assessments.total_score`.
 */
export type AdminOverviewRow = {
    total_users: number;
    total_assessments: number;
    average_score: number;
};

/** `category_score_summary` (0003). One row per category anyone has been assessed in. */
export type CategoryScoreSummaryRow = {
    category_id: number;
    category_name: string;
    assessments_count: number;
    average_score: number;
};

// -----------------------------------------------------------------------------
// The Database type supabase-js is generic over.
// -----------------------------------------------------------------------------

type Table<Row, Insert = Partial<Row>, Relationships extends readonly unknown[] = []> = {
    Row: Row;
    Insert: Insert;
    Update: Partial<Row>;
    Relationships: Relationships;
};

type View<Row> = { Row: Row; Relationships: [] };

/** Columns the database fills in: identity keys, defaults, trigger-managed. */
type Generated = 'created_at' | 'updated_at';

/**
 * Foreign keys, spelled out.
 *
 * supabase-js resolves an embedded select — `select('*, skill_categories(name)')`
 * — from this metadata. With `Relationships: []` the embed does not type-check
 * at all: it resolves to `SelectQueryError<"could not find the relation ...">`,
 * which is the client telling you it cannot see the join. Generated types carry
 * these automatically; a hand-written file has to declare them.
 */
type BelongsTo<
    Name extends string,
    Column extends string,
    Relation extends string,
    Referenced extends string,
> = {
    foreignKeyName: Name;
    columns: [Column];
    isOneToOne: false;
    referencedRelation: Relation;
    referencedColumns: [Referenced];
};

type ToCategory<Name extends string> = BelongsTo<Name, 'category_id', 'skill_categories', 'category_id'>;
type ToUser<Name extends string> = BelongsTo<Name, 'user_id', 'users', 'user_id'>;

export type Database = {
    public: {
        Tables: {
            users: Table<UserRow, Omit<UserRow, 'user_id' | Generated>>;
            skill_categories: Table<
                SkillCategoryRow,
                Omit<SkillCategoryRow, 'category_id' | Generated | 'status'> & {
                    status?: ContentStatus;
                }
            >;
            questions: Table<
                QuestionRow,
                Omit<
                    QuestionRow,
                    | 'question_id'
                    | Generated
                    | 'status'
                    | 'source'
                    | 'created_by'
                    | 'topic_title'
                    | 'study_advice'
                > & {
                    status?: ContentStatus;
                    source?: QuestionSource;
                    created_by?: number | null;
                    topic_title?: string | null;
                    study_advice?: string | null;
                },
                [
                    ToCategory<'questions_category_id_fkey'>,
                    BelongsTo<'questions_created_by_fkey', 'created_by', 'users', 'user_id'>,
                ]
            >;
            answers: Table<
                AnswerRow,
                Omit<AnswerRow, 'answer_id' | 'position'> & { position?: number },
                [BelongsTo<'answers_question_id_fkey', 'question_id', 'questions', 'question_id'>]
            >;
            assessments: Table<
                AssessmentRow,
                Omit<
                    AssessmentRow,
                    | 'assessment_id'
                    | 'created_at'
                    | 'status'
                    | 'total_score'
                    | 'submitted_at'
                    | 'started_at'
                    | 'session_id'
                    | 'time_limit_seconds'
                > & {
                    session_id?: string | null;
                    time_limit_seconds?: number | null;
                    started_at?: string | null;
                },
                [ToCategory<'assessments_category_id_fkey'>, ToUser<'assessments_user_id_fkey'>]
            >;
            student_responses: Table<
                StudentResponseRow,
                Omit<StudentResponseRow, 'student_response_id' | 'is_correct' | 'answered_at'> & {
                    selected_answer_id?: number | null;
                    answered_at?: string | null;
                },
                [
                    BelongsTo<
                        'student_responses_assessment_id_fkey',
                        'assessment_id',
                        'assessments',
                        'assessment_id'
                    >,
                    BelongsTo<
                        'student_responses_question_id_fkey',
                        'question_id',
                        'questions',
                        'question_id'
                    >,
                ]
            >;
            category_progress: Table<
                CategoryProgressRow,
                Omit<
                    CategoryProgressRow,
                    'progress_id' | Generated | 'current_level' | 'last_score' | 'last_assessed_at'
                > & {
                    current_level?: SkillLevel;
                    last_score?: number | null;
                    last_assessed_at?: string | null;
                },
                [ToCategory<'category_progress_category_id_fkey'>, ToUser<'category_progress_user_id_fkey'>]
            >;
            recommendation_plans: Table<
                RecommendationPlanRow,
                Omit<
                    RecommendationPlanRow,
                    | 'recommendation_id'
                    | Generated
                    | 'completed_at'
                    | 'progress_status'
                    | 'priority'
                    | 'ai_description'
                    | 'assessment_id'
                > & {
                    priority?: number;
                    progress_status?: PlanStatus;
                    ai_description?: string | null;
                    assessment_id?: number | null;
                },
                [
                    ToCategory<'recommendation_plans_category_id_fkey'>,
                    ToUser<'recommendation_plans_user_id_fkey'>,
                ]
            >;
            xp_events: Table<
                XpEventRow,
                Omit<XpEventRow, 'xp_event_id' | 'awarded_on' | 'awarded_at'> & {
                    awarded_on?: string;
                },
                [ToUser<'xp_events_user_id_fkey'>]
            >;
        };
        Views: {
            user_xp_totals: View<UserXpTotalRow>;
            leaderboard: View<LeaderboardRow>;
            admin_overview: View<AdminOverviewRow>;
            category_score_summary: View<CategoryScoreSummaryRow>;
        };
        Functions: {
            /** Grades an in-progress assessment and returns the percentage. */
            grade_assessment: {
                Args: { p_assessment_id: number };
                Returns: number;
            };
            /** Consecutive days with XP activity, ending today or yesterday. */
            current_streak: {
                Args: { p_user_id: number };
                Returns: number;
            };
        };
        Enums: {
            user_role: UserRole;
            user_status: UserStatus;
            skill_level: SkillLevel;
            content_status: ContentStatus;
            assessment_status: AssessmentStatus;
            plan_status: PlanStatus;
            question_source: QuestionSource;
            xp_reason: XpReason;
        };
        CompositeTypes: { [_ in never]: never };
    };
};

export type UserUpdate = Partial<Pick<UserRow, 'first_name' | 'last_name'>>;
