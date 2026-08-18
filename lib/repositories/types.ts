/**
 * Repository interfaces — the seam that makes services testable.
 *
 * ARCHITECTURE §7: "Repositories are injected into services specifically so
 * service tests need no Supabase mock. Design for the test at the moment you
 * write the service."
 *
 * Sketch: one interface per repo (ProfileRepo, CategoryRepo, QuestionRepo,
 * AssessmentRepo, ResponseRepo, ProgressRepo, PlanRepo, StatsRepo), each
 * declaring only the methods its services actually use.
 *
 * tests/helpers/in-memory-repos.ts implements every one of these against a
 * plain Map. When you add a method here, add it there in the same commit.
 */
