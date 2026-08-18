/**
 * Every business threshold, once.
 *
 * Stories: SP-041, SP-045, SP-051, SP-052, SP-060
 *
 * Sketch (ARCHITECTURE §4.3)
 *  LEVEL_THRESHOLDS   < 50 beginner · 50-79 intermediate · >= 80 advanced
 *  WEAK_AREA_THRESHOLD 60
 *  QUESTIONS_PER_ASSESSMENT   one number, documented
 *  MIN_QUESTIONS_TO_GENERATE  below this we refuse rather than generate a
 *                             3-question "assessment"
 *  ASSESSMENT_TIME_LIMIT_SECONDS
 *  PLAN_MAX_PRIORITY 5
 *
 * Never inline these numbers anywhere else. Not in a component, not in SQL,
 * not in a test — tests import them too, so changing a threshold changes the
 * expectation in one place.
 *
 * Test: tests/lib/domain/constants.test.ts
 */
