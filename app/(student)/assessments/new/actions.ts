/**
 * Start-assessment action.
 *
 * Layer: ACTION
 * Stories: SP-041, SP-042, SP-048
 *
 * Sketch
 *  startAssessment(formData)
 *   - assertAuth, startSchema.safeParse (categoryId(s), level)
 *   - assessment.service.generate():
 *       one transaction -> assessments row (in_progress)
 *                        + one student_responses row PER QUESTION,
 *                          selected_answer_id null, position sequential
 *       That pre-creation is what makes refresh-safe resume free (D2 / SP-044).
 *   - duplicate run -> service returns the existing id, we redirect into it.
 *     The partial unique index is the backstop, not the first line of defence.
 *   - too few questions -> refuse below the documented minimum, or generate
 *     what exists and warn (decide once, write it in constants.ts)
 *   - redirect(`/assessments/${id}`)
 *
 * Test: tests/app/(student)/assessments/new/actions.test.ts
 */
