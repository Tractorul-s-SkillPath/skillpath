/**
 * Results page.
 *
 * Layer: PAGE
 * Stories: SP-053, SP-051, SP-052
 *
 * Sketch
 *  - total score, per-category score, estimated level, weak areas
 *  - per-question review: your answer, the correct one, correct/incorrect —
 *    this is the one place is_correct is legitimately shown, and only AFTER
 *    submission, server-rendered
 *  - another student's id -> notFound(), because RLS returned nothing (SP-053 AC2)
 *  - session_id set -> group the sibling assessments (SP-048)
 */

import { ComingSoon } from '../../../../../components/coming-soon';

export const metadata = { title: 'Results · SkillPath' };

export default function AssessmentResultsPage() {
    return (
        <ComingSoon
            title="Results"
            description="Your score, the level it implies, and the categories that pulled it down."
            planned={[
                'Total score and per-category score, with the estimated level',
                'Weak areas — every category under the threshold, named',
                'Per-question review: what you picked, what was right — after submission only',
            ]}
        />
    );
}
