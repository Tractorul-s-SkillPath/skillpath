/**
 * E2E: admin creates a question -> a student sees it.
 *
 * Story: SP-101 · owner B
 *
 * Sketch
 *  - log in as the seeded admin, create a category if needed
 *  - create a question with 4 answers, one correct; activate it
 *  - log in as a student, start an assessment in that category, see the question
 *  - assert is_correct appears nowhere in the network payload (ties to SP-038)
 */
