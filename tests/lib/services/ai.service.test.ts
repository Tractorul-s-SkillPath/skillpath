/**
 * Tests for lib/services/ai.service.ts. The mock provider does the work.
 *
 * Stories: SP-090, SP-091, SP-092, SP-093, SP-094
 *
 * Cases
 *  - enhancePlan writes ai_description onto existing rows and changes nothing
 *    else — the rule-based plan is untouched (SP-091)
 *  - provider throws -> ok-with-degradation: the plan still returns, the error
 *    is logged, no exception escapes (SP-090)
 *  - provider times out at 10s -> same
 *  - provider returns malformed output -> caught at the Zod boundary, mapped to
 *    a friendly error, nothing written (SP-092 AC4)
 *  - generateQuestions inserts drafts as status='inactive', source='ai' (SP-092)
 *  - feedback is persisted and the second call returns the stored text rather
 *    than calling the provider again (§6.4)
 *  - AI disabled -> the rule-based fallback from lib/domain/feedback.ts (SP-093)
 *  - no prompt contains anything beyond first name and scores (SP-094)
 */
