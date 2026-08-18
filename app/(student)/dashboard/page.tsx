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
