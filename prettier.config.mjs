/**
 * Prettier — formatting only. This is not a linter and does not replace one;
 * ESLint (SP-122) is still absent, so nothing here catches a bug.
 *
 * Every option below is a deviation from a Prettier default, chosen to match
 * what the codebase already does so adopting the formatter is a whitespace
 * diff and not a rewrite. Measured over the tracked .ts/.tsx files at the time
 * this landed:
 *
 *   tabWidth 4    — 218 files indent in multiples of 4, zero use 2. Prettier's
 *                   default of 2 would reindent every file in the repo.
 *   singleQuote   — 934 single-quoted imports against 3 double-quoted.
 *   printWidth    — line lengths sit at p90 = 79 and p99 = 105. The default 80
 *                   rewraps the long tail; 100 leaves it alone. With 4-space
 *                   indent, 80 also runs out of room fast inside nested JSX.
 *
 * semi and arrowParens are Prettier defaults and already the house style; they
 * are stated here so the file reads as the whole contract rather than a diff
 * against defaults you have to remember.
 */

/** @type {import('prettier').Config} */
export default {
    tabWidth: 4,
    singleQuote: true,
    printWidth: 100,
    semi: true,
    arrowParens: 'always',
    trailingComma: 'all',
    overrides: [
        {
            // YAML, JSON and Markdown are 2-space here and nearly everywhere
            // else; tabWidth 4 is a JS/TS/CSS house style, not a global one.
            files: ['*.{yml,yaml,json,md}'],
            options: { tabWidth: 2 },
        },
    ],
};
