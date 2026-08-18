/**
 * RTL tests for app/(student)/assessments/[id]/countdown-timer.tsx.
 *
 * Story: SP-045
 *
 * Cases
 *  - counts down against fake timers
 *  - reaching zero triggers submit exactly ONCE, even if the tick fires again
 *  - remounting mid-assessment resumes from started_at, not from the full limit
 *  - it displays remaining time but does not decide the outcome — the server does
 */
