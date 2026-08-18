/**
 * Shared Playwright fixtures.
 *
 * Story: SP-101
 *
 * Sketch
 *  - studentPage / adminPage fixtures with storageState, logged in once per run
 *  - uniqueEmail() helper so parallel runs never collide
 *  - cleanup: created rows are removed with the service role after each spec
 */
