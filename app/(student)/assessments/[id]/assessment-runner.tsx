/**
 * Assessment runner — client component. The one genuinely stateful screen.
 *
 * Stories: SP-043, SP-044, SP-045, SP-046
 *
 * Sketch
 *  - props: the responses (question, options, current selection, position)
 *  - selecting an option calls saveAnswer immediately (optimistic UI, revert on
 *    failure) so nothing lives only in React state
 *  - NOTHING in localStorage (SP-044 AC2). The server is the session store.
 *  - progress indicator: answered / total
 *  - <CountdownTimer> -> auto-submit on expiry
 *
 * Test: tests/app/(student)/assessments/[id]/assessment-runner.test.tsx
 */
