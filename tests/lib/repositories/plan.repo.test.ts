/**
 * Integration tests for lib/repositories/plan.repo.ts.
 *
 * Stories: SP-061, SP-063
 *
 * Cases
 *  - upsertMany on (user_id, category_id, topic_title) updates on re-run (SP-061)
 *  - updateStatus changes progress_status and leaves every other column byte-identical
 *  - a student token updating another student's item affects ZERO rows
 *  - setAiDescription touches only ai_description; rule_description survives
 */
