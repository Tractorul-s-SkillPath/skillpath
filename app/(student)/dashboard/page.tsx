/**
 * Student dashboard.
 *
 * Layer: PAGE — calls progress.service, never a repository (§3.2)
 * Stories: SP-070, SP-071, SP-072, SP-073
 *
 * Sketch
 *  - per category: current level, latest score, plan items completed / total
 *  - overall completion percentage across all categories (SP-072)
 *  - brand-new student: <EmptyState> with "take your first assessment" —
 *    never a broken layout, never a crash on zero rows (SP-073)
 */

import { ComingSoon } from '../../../components/coming-soon';

export const metadata = { title: 'Dashboard · SkillPath' };

export default function DashboardPage() {
    return (
        <ComingSoon
            title="Dashboard"
            description="Where you stand in every category you follow, in one screen."
            planned={[
                'Per category: current level, latest score, plan items done out of total',
                'Overall completion across every category you follow',
                'A first-time view that points at your first assessment rather than at zeroes',
            ]}
            backHref="/profile"
            backLabel="Go to your profile"
        />
    );
}
