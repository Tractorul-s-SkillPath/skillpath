/**
 * Tests for lib/repositories/user.repo.ts — integration, needs a test database.
 *
 * Stories: SP-083, SP-014
 *
 * The source names this file in its header; it had no mirror at all until now.
 * Runs in the database job (SP-004), not in the default `npm test`.
 *
 * Cases
 *  - listPaged returns the requested page, and a total that counts every match
 *    rather than the rows on the page
 *  - the password column is NEVER present on a returned row — this is the whole
 *    reason USER_PUBLIC_COLUMNS exists, and a `select('*')` slipping back in is
 *    exactly what this asserts against
 *  - a role filter, a status filter, and both together
 *  - a search term matching first name, last name and email
 *  - a search term containing a comma or a bracket returns results instead of a
 *    400 — the likeTerm quoting, proven through a real PostgREST round trip
 *    (tests/lib/repositories/paging.test.ts covers the string it builds; only
 *    this file proves the server accepts it)
 *  - an out-of-range page returns an empty page, not an error
 *  - setStatus flips active <-> inactive and the change is readable afterwards
 *  - setStatus on a user id that does not exist -> a failure, distinguishable
 *    from "updated nothing"
 */
