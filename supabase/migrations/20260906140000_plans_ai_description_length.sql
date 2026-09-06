-- SP-091 — the bound assessments.ai_feedback has had since SP-093, on the
-- other column that stores model output.
--
-- The asymmetry this closes: `assessments.ai_feedback` is
-- `check (char_length between 1 and 1500)` and mirrors feedbackResponseSchema,
-- while `recommendation_plans.ai_description` was plain `text` with nothing on
-- it at all — even though enhancedPlanItemSchema in lib/ai/schemas.ts bounds it
-- at 600 characters and a plan page renders it the same way a results page
-- renders the other one.
--
-- ARCHITECTURE §6.1: model output is untrusted input. The Zod parse is the
-- boundary; this is the backstop for the bug that skips it — a new call site,
-- a refactor that writes the column directly — so that a 50KB generation
-- cannot land in a column a page renders. Two places to change if the limit
-- ever moves, which is the point: a length that only exists in TypeScript is a
-- length the database will happily accept without it.
--
-- Nullable stays nullable: the rule-based `rule_description` is the half that
-- has to survive, and a provider that is off or down leaves this null on
-- purpose (D5).
--
-- Existing rows: nothing violates this. The column has only ever been written
-- by ai.service.enhancePlan, behind the 600-character schema.

alter table public.recommendation_plans
    add constraint recommendation_plans_ai_description_length
        check (ai_description is null or char_length(ai_description) between 1 and 600);
