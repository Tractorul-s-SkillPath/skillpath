/**
 * The assessment run.
 *
 * Layer: PAGE
 * Stories: SP-043, SP-044, SP-045
 *
 * Sketch
 *  - reads the pre-created student_responses rows ordered by position, joined to
 *    questions and to the answer_options VIEW — never to `answers` (SP-038)
 *  - hands them to <AssessmentRunner /> as the initial state, so a hard refresh
 *    reproduces the same questions in the same order with the same selections
 *  - not owned by this user -> notFound(), courtesy of RLS returning zero rows
 *  - status !== 'in_progress' -> redirect to the results page
 */

import { ComingSoon } from '../../../../components/coming-soon';

export const metadata = { title: 'Assessment · SkillPath' };

export default function AssessmentRunPage() {
    return (
        <ComingSoon
            title="Assessment"
            description="The timed run: one question set, one sitting, the clock visible."
            planned={[
                'Questions in a fixed order, with your selections surviving a refresh',
                'A countdown, and a submit that asks once before it commits',
                'Somebody else’s assessment is a 404, not a peek',
            ]}
            backHref="/assessments/new"
            backLabel="Start an assessment"
        />
    );
}
