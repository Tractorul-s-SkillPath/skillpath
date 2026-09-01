/**
 * Vitest global setup.
 *
 * Live today:
 *  - AI_PROVIDER=mock, so nothing in the suite can reach a real model (SP-090)
 *  - an unhandled rejection fails the run instead of passing quietly
 *
 * Deliberately not here yet — each lands with the layer that needs it:
 *  - @testing-library/jest-dom matchers and cleanup(), for component tests.
 *    Neither @testing-library/react nor @vitejs/plugin-react is installed, so
 *    a .tsx test cannot run at all until they are.
 *  - a frozen clock helper, once a timer or plan test needs one. lib/domain
 *    takes `now` as a parameter, so nothing needs it so far.
 */

process.env.AI_PROVIDER = 'mock';

process.on('unhandledRejection', (reason) => {
    throw reason;
});
