/**
 * Learning plan.
 *
 * Layer: PAGE
 * Stories: SP-062, SP-064, SP-065
 *
 * Sketch
 *  - grouped by category, ordered by priority (1 = most urgent)
 *  - each item: topic title, rule_description, ai_description when present,
 *    status control
 *  - the rule-based text renders first and always. AI text is decoration; a
 *    failed provider must leave no error banner (SP-091 AC3)
 *  - no weak areas -> "you're solid here, try the next level" (SP-064)
 *  - shows only the latest assessment's plan per category (SP-065)
 */

import { ComingSoon } from '../../../components/coming-soon';

export const metadata = { title: 'Your plan · SkillPath' };

export default function PlanPage() {
    return (
        <ComingSoon
            title="Your learning plan"
            description="The weak areas from your assessments, turned into things to do."
            planned={[
                'Plan items grouped by category and ordered by priority',
                'Each item: topic, why it was recommended, and a status you can move',
                'AI-written detail where a provider produced it, rule-based text always',
                'No weak areas — an invitation to try the next level up',
            ]}
        />
    );
}
