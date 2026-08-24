/**
 * Tests for lib/domain/levels.ts.
 *
 * Story: SP-051 — boundaries are the point.
 *
 * Cases
 *  - 49.9 -> beginner · 50 -> intermediate
 *  - 79.9 -> intermediate · 80 -> advanced
 *  - 0 -> beginner · 100 -> advanced
 *  - the difficulty mix rule, exactly as documented in levels.ts
 *  - thresholds are read from constants.ts (change the constant, the test moves
 *    with it — a hardcoded 50 in here would defeat the purpose)
 */
