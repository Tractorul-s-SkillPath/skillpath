/**
 * AI orchestration — the only caller of lib/ai.
 *
 * Layer: SERVICE
 * Stories: SP-090, SP-091, SP-092, SP-093, SP-094
 *
 * Sketch
 *  enhancePlan(assessmentId)      - SP-091: writes ai_description onto existing
 *    plan rows. The rule-based plan already exists and already renders; this only
 *    ever ADDS. Persisted once, never regenerated per page view (§6.4).
 *  generateQuestions(spec)        - SP-092: returns Zod-parsed drafts for review
 *  feedbackFor(assessmentId)      - SP-093: persisted, so the same result always
 *    shows the same text; falls back to lib/domain/feedback.ts
 *
 * Every path here obeys §6: parse model output with Zod before the database,
 * degrade instead of blocking, keep the human in the loop, persist the output.
 * Provider failure is a logged, caught, non-fatal condition — never a 500 and
 * never an error banner on a page that is otherwise correct.
 *
 * Test: tests/lib/services/ai.service.test.ts  (mock provider, plus a provider
 * that throws and one that times out)
 */


 import { generateObject } from 'ai';
 import { anthropic } from '@ai-sdk/anthropic';
 import { createClient } from '../supabase/server';
 import { aiStudyPlanSchema } from '../ai/schemas';
 import { ok, err, type Result } from '../result';
 import { appError, type AppError } from '../errors';

 export async function generateAndSaveStudyPlan(
     userId: string,
     assessmentId: number,
     missedQuestions: any[]
 ): Promise<Result<any, AppError>> {
     const supabase = await createClient();

     // Aici AI-ul ar trebui să gândească. Noi îi simulăm răspunsul perfect:
     const mockObject = {
         explanation: "Acesta este un mesaj de test (Mock). Analiza arată că te-ai descurcat bine per total, dar există câteva concepte de bază care necesită atenție pentru a-ți consolida fundația.",
         recommendations: [
             {
                 title: "Revizuirea conceptelor fundamentale",
                 focusArea: missedQuestions[0]?.topicTitle || "Subiect General",
                 rationale: "Întrebările ratate indică o ușoară confuzie legată de conceptele teoretice de bază.",
                 actionItems: [
                     "Recitește documentația oficială despre acest subiect.",
                     "Rezolvă 3 exerciții practice introductive.",
                     "Urmărește un tutorial scurt pentru recapitulare."
                 ],
                 estimatedMinutes: 30
             }
         ]
     };

     try {
         // Salvăm datele false în baza de date
         const { error } = await supabase
             .from('ai_study_plans')
             .insert({
                 user_id: userId,
                 assessment_id: assessmentId,
                 plan_data: mockObject
             });

         if (error) return err(appError('database_error', error.message));
         return ok(mockObject);
     } catch (error: any) {
         return err(appError('internal_error', error.message));
     }
 }