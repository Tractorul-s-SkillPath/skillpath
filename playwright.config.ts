/**
 * Playwright config.
 *
 * Story: SP-101
 *
 * Sketch
 *  - testDir: './e2e'
 *  - baseURL from PLAYWRIGHT_BASE_URL — the Vercel preview URL in CI,
 *    localhost only as the fallback
 *  - one project (chromium) is enough for three happy paths
 *  - trace on first retry
 */
