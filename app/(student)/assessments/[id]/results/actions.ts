'use server';

import { feedbackForScore } from '../../../../../lib/services/ai.service';

export async function getAIFeedbackAction(assessmentId: string, score: number, weakAreas: string[]) {
    try {
        const feedback = await feedbackForScore(assessmentId, score, weakAreas);
        return { success: true, feedback };
    } catch (error) {
        return {
            success: false,
            feedback: `You completed the assessment with a score of ${score}%. Keep reviewing your weak areas to improve further!`
        };
    }
}