/**
 * RTL tests for app/(student)/assessments/[id]/assessment-runner.tsx.
 * The one screen with enough logic to earn a component test.
 *
 * Stories: SP-043, SP-044, SP-046
 *
 * Cases
 *  - renders questions in position order
 *  - initial selections from the server are pre-selected on first paint —
 *    this is what a hard refresh looks like to the user (SP-044)
 *  - choosing an option fires saveAnswer once with the right ids
 *  - a failed save reverts the optimistic selection and says so
 *  - progress reads "3 of 10 answered" and updates as you go
 *  - NOTHING is written to localStorage or sessionStorage (SP-044 AC2) —
 *    assert on the storage APIs directly
 *  - no rendered prop or DOM attribute contains is_correct (SP-038)
 */
