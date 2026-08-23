/**
 * AI question generator.
 *
 * Layer: PAGE
 * Story: SP-092 · owner B — a graded differentiator
 *
 * Sketch: the generate form, then the draft review queue
 * (source='ai', status='inactive') awaiting a human.
 */

import { ComingSoon } from '../../../../../components/coming-soon';

export const metadata = { title: 'Generate questions · SkillPath admin' };

export default function AdminGenerateQuestionsPage() {
    return (
        <ComingSoon
            title="Generate questions"
            description="Draft new questions with AI, then review every one before it goes live."
            planned={[
                'A generate form: category, difficulty, how many',
                'A review queue of drafts, inactive until a human approves them',
            ]}
            backHref="/admin/questions"
            backLabel="Back to the question bank"
        />
    );
}
