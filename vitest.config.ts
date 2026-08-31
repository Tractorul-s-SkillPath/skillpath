/**
 * Vitest config — the coverage gate lives here.
 *
 * Stories: SP-005, SP-100
 *
 * Sketch (ARCHITECTURE §7)
 *  - environment: jsdom, setupFiles: ['tests/setup.ts']
 *  - include: ['tests/**\/*.test.ts?(x)']
 *  - exclude from the run by default: tests/db/**, tests/lib/repositories/**
 *    (they need a live Supabase test project — separate script, own CI job)
 *  - coverage.include: ['lib/domain/**', 'lib/services/**', 'lib/validation/**']
 *    thresholds: lines 75, functions 75, branches 70, statements 75
 *  - path alias '@/' -> project root, mirrored from tsconfig
 *
 * The gate is switched on in Slice 0, not in Week 6 (risk table, ARCHITECTURE §10).
 */

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    test: {
        environment: 'jsdom',
        setupFiles: ['./tests/setup.ts'],
        include: ['tests/**/*.test.ts?(x)'],
        exclude: ['tests/db/**', 'tests/lib/repositories/**'],
        coverage: {
            provider: 'v8',
            include: ['lib/domain/**', 'lib/services/**', 'lib/validation/**'],
            thresholds: {
                lines: 75,
                functions: 75,
                branches: 70,
                statements: 75,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
});