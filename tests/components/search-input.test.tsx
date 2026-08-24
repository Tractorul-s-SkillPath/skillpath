/**
 * RTL tests for components/search-input.tsx.
 *
 * Stories: SP-084, SP-085
 *
 * Cases
 *  - debounces: three keystrokes -> one URL update
 *  - the initial value comes from the URL, so a shared link is pre-filled
 *  - clearing removes the param
 *  - history is replaced, not pushed — Back should leave the page, not undo
 *    each keystroke
 */
