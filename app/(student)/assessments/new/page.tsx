/**
 * Start an assessment — picker.
 *
 * Layer: PAGE
 * Story: SP-040
 *
 * Sketch
 *  - lists ACTIVE categories that have >=1 eligible question
 *    (eligible = active question with a correct answer, at the chosen level)
 *  - level defaults to the student's current_level for that category
 *  - an in-progress assessment already exists -> jump straight into it (SP-042)
 */

import { ComingSoon } from '../../../../components/coming-soon';

export const metadata = { title: 'Start an assessment · SkillPath' };

export default function NewAssessmentPage() {
    return (
        <ComingSoon
            title="Start an assessment"
            description="Pick a category and a target level, and the question set is drawn for you."
            planned={[
                'Active categories that actually have questions to ask',
                'A target level, defaulting to your current level in that category',
                'An assessment already in progress takes you straight back into it',
            ]}
        />
    );
}
