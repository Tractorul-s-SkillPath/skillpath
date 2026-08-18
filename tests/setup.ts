/**
 * Vitest global setup.
 *
 * Sketch
 *  - @testing-library/jest-dom matchers
 *  - cleanup() after each test
 *  - AI_PROVIDER=mock, so nothing in the suite can reach a real model (SP-090)
 *  - fail loudly on an unhandled rejection instead of passing quietly
 *  - a fixed, frozen clock helper so timer and plan tests are deterministic
 */
