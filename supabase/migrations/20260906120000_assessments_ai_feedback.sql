-- SP-093 — the AI Feedback Assistant needs somewhere to put its answer.
--
-- ARCHITECTURE §6.4: persist the output, never regenerate it per page view.
-- Without a column the same submitted run would produce different encouragement
-- on every refresh, which is the opposite of what the story asks for, and would
-- bill a model call for each one.
--
-- On the assessment rather than in a table of its own: feedback is one string
-- about one graded run, there is at most one of it, and it dies with the run.
-- A row per assessment in a side table would buy nothing but a join.
--
-- Nullable, because it is written after grading and may never be written at
-- all — a provider that is off or down leaves this null and the page renders
-- the rule-based text from lib/domain/feedback.ts instead.
--
-- The length bound mirrors feedbackResponseSchema in lib/ai/schemas.ts. Model
-- output is untrusted input (§6.1) and the database says so too, so a bug that
-- skips the Zod parse cannot land a 50KB generation in a column a page renders.

alter table public.assessments
    add column ai_feedback text
        check (ai_feedback is null or char_length(ai_feedback) between 1 and 1500);
