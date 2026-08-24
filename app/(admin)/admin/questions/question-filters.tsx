/**
 * Question search + filters.
 *
 * Stories: SP-084, SP-085
 *
 * Sketch
 *  - free text on question text; selects for category / difficulty / status /
 *    source; all combinable
 *  - state lives in the URL (useRouter + searchParams), so it survives refresh
 *    and can be pasted to a teammate. No useState mirror of the URL.
 *  - debounce the text input; the query runs in Postgres, not in JS (SP-086)
 */
