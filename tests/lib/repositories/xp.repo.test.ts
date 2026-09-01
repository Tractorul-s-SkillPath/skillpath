/**
 * Tests for lib/repositories/xp.repo.ts — integration, needs a test database.
 *
 * Stories: SP-070, SP-071, SP-072
 *
 * The source names this file in its header; it had no mirror at all until now.
 * Runs in the database job (SP-004), not in the default `npm test`.
 *
 * This one is worth more than a typical repository test, because most of what
 * it covers is written by TRIGGERS in 0002_functions.sql rather than by this
 * file. Nothing in the application asserts that submitting an assessment
 * awards XP — the database does it, and only a test against a real database
 * can see it happen. tests/db/triggers.test.ts approaches the same seam from
 * the SQL side; this is the repository's view of it.
 *
 * Cases
 *  - totalFor sums the ledger, and returns 0 (never null) for a member with no
 *    events — a null reaching the header renders as a blank badge
 *  - streakFor counts consecutive days by awarded_on in Europe/Bucharest, not
 *    in the server's timezone (SP-072); two events on the same local day are
 *    one day of streak, not two
 *  - streakFor returns 0 for a member whose last activity was before yesterday
 *  - historyFor returns newest first
 *  - awardBadges writes XP_PER_BADGE per badge and is IDEMPOTENT: calling it
 *    twice with the same code awards once. The ledger is append-only, so a
 *    duplicate cannot be cleaned up afterwards — this is the case that matters
 *  - awardBadges with an empty array writes nothing and still succeeds
 *  - badgeAwardsFor returns the earned-at timestamp keyed by code
 *  - leaderboard ranks by total_xp descending, and myRank is the caller's row
 *    even when they fall outside the returned page
 *  - a member with no XP still appears with a rank rather than being absent
 *
 * Not covered here, deliberately: nothing updates or deletes a row. The ledger
 * is append-only and there is no method to test.
 */
