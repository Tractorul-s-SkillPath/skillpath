/**
 * RTL tests for components/pagination.tsx.
 *
 * Stories: SP-030, SP-033, SP-082
 *
 * Cases
 *  - previous is disabled on page 1, next on the last page
 *  - clicking next writes page=2 to the URL
 *  - a total of 0 renders the control in a disabled, non-broken state
 *  - the page count is derived from the server's total, not from rows.length
 */
