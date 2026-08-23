/**
 * Question bank list.
 *
 * Layer: PAGE
 * Stories: SP-033, SP-084, SP-086
 *
 * Sketch
 *  - columns: text, category, difficulty, status, source (manual / ai)
 *  - SERVER-side pagination and filtering; no endpoint returns an unbounded set
 *  - reads go through question.service (service role, assertAdmin) because
 *    `answers` is unreachable over PostgREST by design (§5)
 */

import { ComingSoon } from '../../../../components/coming-soon';

export const metadata = { title: 'Question bank · SkillPath admin' };

export default function AdminQuestionsPage() {
    return (
        <ComingSoon
            title="Question bank"
            description="Every question, its category, its difficulty, and where it came from."
            planned={[
                'Columns: text, category, difficulty, status, source (manual or AI)',
                'Server-side paging and filtering — no screen ever loads the whole bank',
                'Editing a question and its answers, including which one is correct',
            ]}
            backHref="/admin"
            backLabel="Back to admin overview"
        />
    );
}
