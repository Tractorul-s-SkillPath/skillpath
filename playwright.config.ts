/**
 * Playwright — the end-to-end journey.
 *
 * Story: SP-101
 *
 * THREE SETTINGS HERE ARE LOAD-BEARING AND LOOK LIKE BOILERPLATE:
 *
 * 1. `webServer.env` is how the app under test is pointed at the TEST Supabase
 *    project. It is not `.env.test` and not `.env.e2e` read by Next — Next
 *    loads `.env.local` for `next start` and reasoning about which file wins
 *    is exactly the kind of thing to get wrong once and never notice. Real
 *    process environment beats every `.env` file, so setting it on the spawned
 *    server ends the question.
 *
 * 2. `reuseExistingServer: false`, on a port that is not 3000. A dev server
 *    somebody left running is pointed at `.env.local` — reusing it would run
 *    the whole journey against the demo project with every guard in
 *    e2e/helpers/env.ts still reporting green.
 *
 * 3. `workers: 1`. One shared database, and the baseline is one attempt per
 *    member. Runs use a fresh identity so they do not collide on rows, but
 *    they would collide on `npm run build` and on the cost of a second server.
 *
 * Not in `npm test` and never will be: this needs a database and a browser,
 * the same reason tests/db is excluded from the Vitest run.
 */

import { defineConfig, devices } from '@playwright/test';
import { e2eEnv } from './e2e/helpers/env';

const env = e2eEnv();

/**
 * `next build && next start` is what CI runs, because it is what ships.
 * `E2E_DEV=1` swaps in the dev server for the ~40 seconds a rebuild costs on
 * every iteration while a test is being written. The one behavioural
 * difference is the session cookie's `secure` flag, which `lib/auth/session.ts`
 * sets only in production — browsers treat 127.0.0.1 as trustworthy, so the
 * cookie survives either way, and the journey asserts it does.
 */
const useDevServer = !process.env.CI && process.env.E2E_DEV === '1';

export default defineConfig({
    testDir: './e2e',
    globalSetup: './e2e/global-setup.ts',

    fullyParallel: false,
    workers: 1,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,

    // A 20-question paper with a save round trip per answer. The default 30s
    // is not generous here, and a timeout that fires mid-journey reads as a
    // product bug.
    timeout: 120_000,
    expect: { timeout: 15_000 },

    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

    use: {
        baseURL: env.baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: process.env.CI ? 'retain-on-failure' : 'off',
    },

    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

    webServer: {
        command: useDevServer
            ? `npm run dev -- --port ${env.port}`
            : `npm run build && npm run start -- --port ${env.port}`,
        url: env.baseURL,
        reuseExistingServer: false,
        timeout: 240_000,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
            NEXT_PUBLIC_SUPABASE_URL: env.supabaseUrl,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: env.supabaseKey,
            // Load-bearing. lib/supabase/server.ts reads this now, and both
            // `next dev` and `next start` load .env.local — so without this
            // line the app under test runs against the TEST project's url
            // holding the DEMO project's service-role key. e2e/helpers/env.ts
            // guards the pair, but it can only guard what it is given.
            SUPABASE_SERVICE_ROLE_KEY: env.serviceRoleKey,
            SESSION_SECRET: env.sessionSecret,
        },
    },
});
