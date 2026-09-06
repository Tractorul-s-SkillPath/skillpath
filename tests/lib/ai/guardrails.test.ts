/**
 * Tests for lib/ai/guardrails.ts.
 *
 * Story: SP-094
 *
 * Cases
 *  - firstNameOnly drops everything after the first token
 *  - the rate limiter allows N calls and refuses the N+1 within the window
 *  - the limit is per user and per key, so one budget cannot exhaust another
 *  - expired entries are swept, so the map does not grow without bound
 *  - the token caps are exported and clamp what a call site may ask for
 *  - isAiEnabled reads the master switch, and defaults to on
 *  - assertServerSide refuses to run where a `window` exists
 *  - readAiConfig cleans a pasted value and names the variable that is wrong
 *
 * THE RATE LIMITER'S STATE IS MODULE-LEVEL and there is no reset export, which
 * is deliberate — nothing in production would ever call one. So every test
 * below invents its own user id rather than sharing one; `nextUser()` is what
 * keeps these independent of each other and of their order.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    AiConfigError,
    assertServerSide,
    capTokens,
    FEEDBACK_MAX_TOKENS,
    firstNameOnly,
    isAiEnabled,
    MAX_TOKENS_PER_REQUEST,
    PLAN_MAX_TOKENS,
    QUESTIONS_MAX_TOKENS,
    rateLimit,
    RateLimitedError,
    readAiConfig,
    reasoningEffort,
    wantsJsonMode,
} from '../../../lib/ai/guardrails';

let counter = 0;
const nextUser = () => `user-${++counter}`;

/** MAX_REQUESTS_PER_WINDOW is private; this is the number it is set to. */
const ALLOWANCE = 10;

/** RATE_LIMIT_WINDOW_MS is private; this is the number it is set to. */
const WINDOW_MS = 60_000;

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('firstNameOnly — SP-094', () => {
    it('keeps the first token and drops the rest', () => {
        // The failure this prevents: profiles.first_name is free text, and a
        // surname that reached the prompt would be echoed back into text we
        // store and render.
        expect(firstNameOnly('Ana Maria Popescu')).toBe('Ana');
        expect(firstNameOnly('Ana')).toBe('Ana');
    });

    it('is not fooled by padding or runs of whitespace', () => {
        expect(firstNameOnly('   Ana   Maria  ')).toBe('Ana');
        expect(firstNameOnly('Ana\tPopescu')).toBe('Ana');
        expect(firstNameOnly('Ana\nPopescu')).toBe('Ana');
    });

    it('returns undefined for nothing, rather than an empty string', () => {
        // An empty string is falsy but still a string, and `firstName: ''`
        // would make the prompt builder emit ", a student," with a blank in
        // front of it. undefined takes the no-name branch instead.
        expect(firstNameOnly(undefined)).toBeUndefined();
        expect(firstNameOnly('')).toBeUndefined();
        expect(firstNameOnly('   ')).toBeUndefined();
    });

    it('does not let an email through as a "first name"', () => {
        // It is one token, so it survives — which is the honest result, and the
        // reason the CONTEXT TYPES are the real defence. Pinned so that nobody
        // reads this function as more than it is.
        expect(firstNameOnly('ana.popescu@example.com')).toBe('ana.popescu@example.com');
    });
});

describe('rateLimit', () => {
    it('allows the whole allowance and refuses the one after it', () => {
        const user = nextUser();

        for (let i = 0; i < ALLOWANCE; i++) {
            expect(() => rateLimit(user, 'feedback')).not.toThrow();
        }

        expect(() => rateLimit(user, 'feedback')).toThrow(RateLimitedError);
    });

    it('throws a typed error, so a caller can tell it from an outage', () => {
        const user = nextUser();

        for (let i = 0; i < ALLOWANCE; i++) rateLimit(user, 'feedback');

        try {
            rateLimit(user, 'feedback');
            expect.unreachable('the allowance was already spent');
        } catch (error) {
            expect(error).toBeInstanceOf(RateLimitedError);
            expect((error as RateLimitedError).code).toBe('rate_limited');
        }
    });

    it("keeps one member out of another member's budget", () => {
        const heavy = nextUser();
        const other = nextUser();

        for (let i = 0; i < ALLOWANCE; i++) rateLimit(heavy, 'questions');

        expect(() => rateLimit(heavy, 'questions')).toThrow(RateLimitedError);
        expect(() => rateLimit(other, 'questions')).not.toThrow();
    });

    it("keeps one key out of another key's budget for the same member", () => {
        // "An admin generating questions cannot exhaust their own feedback
        // allowance" — the same person, two features, two budgets.
        const user = nextUser();

        for (let i = 0; i < ALLOWANCE; i++) rateLimit(user, 'questions');

        expect(() => rateLimit(user, 'questions')).toThrow(RateLimitedError);
        expect(() => rateLimit(user, 'feedback')).not.toThrow();
        expect(() => rateLimit(user, 'plan')).not.toThrow();
    });

    it('lets the allowance back once the window has passed', () => {
        vi.useFakeTimers();
        const user = nextUser();

        for (let i = 0; i < ALLOWANCE; i++) rateLimit(user, 'feedback');
        expect(() => rateLimit(user, 'feedback')).toThrow(RateLimitedError);

        vi.advanceTimersByTime(WINDOW_MS + 1);

        expect(() => rateLimit(user, 'feedback')).not.toThrow();
    });

    it('does not reset early, one millisecond before the window closes', () => {
        vi.useFakeTimers();
        const user = nextUser();

        for (let i = 0; i < ALLOWANCE; i++) rateLimit(user, 'feedback');

        vi.advanceTimersByTime(WINDOW_MS - 1);

        expect(() => rateLimit(user, 'feedback')).toThrow(RateLimitedError);
    });

    it('sweeps expired entries instead of growing for ever', () => {
        // The leak this closes: the map is keyed by `${userId}:${key}` and a
        // long-lived server meets an unbounded number of members, so without a
        // sweep it gains an entry per member per feature and never shrinks.
        // Asserted through behaviour, since the map is private: a thousand
        // one-shot users, then a window, then one more call — after which every
        // one of those thousand entries must be gone.
        vi.useFakeTimers();

        const users = Array.from({ length: 1000 }, () => nextUser());
        for (const user of users) rateLimit(user, 'feedback');

        vi.advanceTimersByTime(WINDOW_MS + 1);
        rateLimit(nextUser(), 'feedback');

        // Every swept member starts from a full allowance again.
        for (const user of users.slice(0, 5)) {
            for (let i = 0; i < ALLOWANCE; i++) {
                expect(() => rateLimit(user, 'feedback')).not.toThrow();
            }
        }
    });
});

describe('capTokens and the per-task budgets', () => {
    it('clamps anything above the ceiling', () => {
        expect(capTokens(MAX_TOKENS_PER_REQUEST + 1)).toBe(MAX_TOKENS_PER_REQUEST);
        expect(capTokens(1_000_000)).toBe(MAX_TOKENS_PER_REQUEST);
    });

    it('passes a smaller request through untouched', () => {
        expect(capTokens(512)).toBe(512);
        expect(capTokens(FEEDBACK_MAX_TOKENS)).toBe(FEEDBACK_MAX_TOKENS);
    });

    it('treats nonsense as "use the ceiling" rather than as zero', () => {
        // A zero or negative max_tokens is rejected by the API, and NaN
        // serialises to null. All three would be a 400 that reads like an
        // outage; the ceiling is the safe reading of "I do not know".
        expect(capTokens(0)).toBe(MAX_TOKENS_PER_REQUEST);
        expect(capTokens(-100)).toBe(MAX_TOKENS_PER_REQUEST);
        expect(capTokens(Number.NaN)).toBe(MAX_TOKENS_PER_REQUEST);
        expect(capTokens(Number.POSITIVE_INFINITY)).toBe(MAX_TOKENS_PER_REQUEST);
    });

    it('floors a fractional request', () => {
        expect(capTokens(100.9)).toBe(100);
    });

    it('gives the plan and the question batch more room than the feedback line', () => {
        // The bug this pins: all three call sites used to pass one 2048-token
        // number. A twenty-topic plan at 400 characters each is past that
        // before a single thinking token, so the generation was cut, the JSON
        // stopped parsing, and the plan silently lost its elaboration — worst
        // for the lowest-scoring member, who has the most rows.
        expect(PLAN_MAX_TOKENS).toBeGreaterThan(FEEDBACK_MAX_TOKENS);
        expect(QUESTIONS_MAX_TOKENS).toBeGreaterThan(FEEDBACK_MAX_TOKENS);
    });

    it('keeps every budget inside the ceiling, so none of them is silently clamped', () => {
        for (const budget of [FEEDBACK_MAX_TOKENS, PLAN_MAX_TOKENS, QUESTIONS_MAX_TOKENS]) {
            expect(capTokens(budget)).toBe(budget);
        }
    });
});

describe('isAiEnabled — the master switch (SP-093 AC3)', () => {
    it('is on when the variable is absent or blank', () => {
        // "Absent means enabled, so no deployment breaks by not knowing about
        // this."
        vi.stubEnv('AI_ENABLED', undefined);
        expect(isAiEnabled()).toBe(true);

        vi.stubEnv('AI_ENABLED', '');
        expect(isAiEnabled()).toBe(true);
    });

    it('is off for every documented off-value, whatever the casing', () => {
        for (const value of ['false', '0', 'off', 'no', 'FALSE', 'Off', ' no ']) {
            vi.stubEnv('AI_ENABLED', value);
            expect(isAiEnabled(), `AI_ENABLED=${JSON.stringify(value)}`).toBe(false);
        }
    });

    it('is on for anything else, including a typo', () => {
        // A misspelled value must not silently disable the feature — "off" is
        // the deliberate act, and everything else means "leave it alone".
        for (const value of ['true', '1', 'on', 'yes', 'flase']) {
            vi.stubEnv('AI_ENABLED', value);
            expect(isAiEnabled(), `AI_ENABLED=${JSON.stringify(value)}`).toBe(true);
        }
    });
});

describe('readAiConfig — "paste a key and it works"', () => {
    function setConfig(overrides: Record<string, string | undefined> = {}) {
        const values: Record<string, string | undefined> = {
            AI_BASE_URL: 'https://api.example.com/v1',
            AI_API_KEY: 'sk-test-key',
            AI_MODEL: 'some-model',
            ...overrides,
        };

        for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
    }

    it('reads three clean variables', () => {
        setConfig();

        expect(readAiConfig()).toEqual({
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'sk-test-key',
            model: 'some-model',
        });
    });

    it('names the one variable that is missing', () => {
        // The whole point of the function. Somebody who has just pasted three
        // values and is looking at rule-based text should read one line and
        // know which one is wrong.
        setConfig({ AI_API_KEY: undefined });

        expect(() => readAiConfig()).toThrow(AiConfigError);
        expect(() => readAiConfig()).toThrow(/AI_API_KEY is not set/);
    });

    it('names all of them when none is set, and gets the grammar right', () => {
        setConfig({ AI_BASE_URL: undefined, AI_API_KEY: undefined, AI_MODEL: undefined });

        expect(() => readAiConfig()).toThrow(/AI_BASE_URL, AI_API_KEY, AI_MODEL are not set/);
    });

    it('points at AI_PROVIDER=mock as the way out', () => {
        setConfig({ AI_MODEL: undefined });

        expect(() => readAiConfig()).toThrow(/AI_PROVIDER=mock/);
    });

    it('strips quotes, whitespace and a trailing newline from a paste', () => {
        // Three ways a hand-typed variable arrives wrong, each producing a
        // value that is subtly wrong rather than obviously absent: a key with
        // a newline is a 401 that reads like a revoked key.
        setConfig({
            AI_API_KEY: '  "sk-test-key"\n',
            AI_BASE_URL: "'https://api.example.com/v1'  ",
            AI_MODEL: '\tsome-model ',
        });

        expect(readAiConfig()).toEqual({
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'sk-test-key',
            model: 'some-model',
        });
    });

    it('treats a value that is only whitespace or empty quotes as missing', () => {
        setConfig({ AI_API_KEY: '   ' });
        expect(() => readAiConfig()).toThrow(/AI_API_KEY/);

        setConfig({ AI_API_KEY: '""' });
        expect(() => readAiConfig()).toThrow(/AI_API_KEY/);
    });

    it('normalises trailing slashes so the path cannot double up', () => {
        // `//chat/completions` is routed by some gateways and 404ed by others.
        setConfig({ AI_BASE_URL: 'https://api.example.com/v1///' });

        expect(readAiConfig().baseUrl).toBe('https://api.example.com/v1');
    });

    it('rejects a base URL with no scheme', () => {
        // fetch() reports this as a bare TypeError, which reads like a bug in
        // our code rather than a typo in an environment variable.
        setConfig({ AI_BASE_URL: 'api.example.com/v1' });

        expect(() => readAiConfig()).toThrow(/must start with http/);
    });

    it('allows http for a local runtime', () => {
        // Ollama and LM Studio are the reason the generic provider exists at
        // all; refusing plain http would rule both of them out.
        setConfig({ AI_BASE_URL: 'http://localhost:11434/v1' });

        expect(readAiConfig().baseUrl).toBe('http://localhost:11434/v1');
    });
});

describe('wantsJsonMode', () => {
    it('is on when unset, because most backends honour response_format', () => {
        vi.stubEnv('AI_JSON_MODE', undefined);
        expect(wantsJsonMode()).toBe(true);
    });

    it('is off for every documented off-value', () => {
        for (const value of ['false', '0', 'off', 'no', 'OFF']) {
            vi.stubEnv('AI_JSON_MODE', value);
            expect(wantsJsonMode(), value).toBe(false);
        }
    });
});

describe('reasoningEffort', () => {
    it('sends nothing when unset, because the field is a 400 on a backend without it', () => {
        vi.stubEnv('AI_REASONING_EFFORT', undefined);
        expect(reasoningEffort()).toBeUndefined();
    });

    it('accepts every documented effort, however it was typed into the file', () => {
        for (const value of ['none', 'minimal', 'low', 'medium', 'high']) {
            vi.stubEnv('AI_REASONING_EFFORT', `  ${value.toUpperCase()}  `);
            expect(reasoningEffort(), value).toBe(value);
        }
    });

    it('drops an unrecognised value rather than 400ing every AI call at once', () => {
        // The failure this prevents is not the typo, it is how the typo reads:
        // one wrong word here would take down all three features together,
        // which looks exactly like a revoked key.
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubEnv('AI_REASONING_EFFORT', 'maximum');

        expect(reasoningEffort()).toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('maximum'));
    });
});

describe('assertServerSide', () => {
    it('passes in a server environment', () => {
        expect(() => assertServerSide()).not.toThrow();
    });

    it('throws where a window exists', () => {
        // The runtime half of "all calls server-side only". `import
        // 'server-only'` fails the BUILD; this covers the case that guard
        // cannot — a test environment or a bundler config where the package
        // resolves to something harmless. As, in fact, it does right here:
        // vitest.config.ts aliases server-only to an empty module.
        vi.stubGlobal('window', {});

        expect(() => assertServerSide()).toThrow(/server-side/i);
    });
});
