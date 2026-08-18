/**
 * AI generation actions.
 *
 * Layer: ACTION
 * Stories: SP-092, SP-094
 *
 * Sketch
 *  generateQuestions({ categoryId, difficulty, count })
 *   - assertAdmin, zod on the request, count capped
 *   - ai.service.generateQuestions() -> provider -> Zod-parse the model output
 *     BEFORE it touches the database (model output is untrusted input, §6.1)
 *   - inserts drafts status='inactive', source='ai'
 *   - malformed output -> "generation failed, try again". Never a 500 (SP-092 AC4)
 *   - rate limited; all calls server-side only (SP-094)
 *
 *  acceptDraft / rejectDraft
 *
 * Test: tests/app/(admin)/admin/questions/generate/actions.test.ts
 */
