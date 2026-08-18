/**
 * Debounced, URL-backed search box.
 *
 * Stories: SP-084, SP-085
 *
 * Sketch
 *  - writes to a named search param, replaces history rather than pushing
 *  - debounce ~300ms; resets page to 1 on change
 *  - the single implementation behind every filter bar in the admin area
 *
 * Test: tests/components/search-input.test.tsx
 */
