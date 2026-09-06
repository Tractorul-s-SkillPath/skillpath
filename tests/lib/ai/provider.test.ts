/**
 * Tests for lib/ai/provider.ts.
 *
 * Story: SP-090
 *
 * Cases
 *  - AI_PROVIDER unset -> the mock provider (the safe default)
 *  - AI_PROVIDER=mock -> mock; =openai -> the generic provider
 *  - an unknown value -> mock plus a warning, never a crash at import time
 *  - both implementations satisfy the same interface (compile-time + a shape test)
 *
 * The env var is read INSIDE getProvider rather than at module scope, which is
 * what makes these tests possible at all — and is also the production
 * requirement, since a module-level read would freeze whatever the environment
 * held when the file was first imported.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiUnavailableError, getProvider, type AiProvider } from '../../../lib/ai/provider';
import { mockProvider } from '../../../lib/ai/mock';
import { openAiCompatibleProvider } from '../../../lib/ai/openai-compatible';

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('getProvider', () => {
    it('defaults to the mock when the variable is unset', () => {
        // The safe default, and the one CI depends on: a broken API key must
        // never block a teammate, and an unset variable must never spend money.
        vi.stubEnv('AI_PROVIDER', undefined);

        expect(getProvider()).toBe(mockProvider);
    });

    it('defaults to the mock when the variable is blank', () => {
        vi.stubEnv('AI_PROVIDER', '');

        expect(getProvider()).toBe(mockProvider);
    });

    it('returns the mock for "mock" and the real one for "openai"', () => {
        vi.stubEnv('AI_PROVIDER', 'mock');
        expect(getProvider()).toBe(mockProvider);

        vi.stubEnv('AI_PROVIDER', 'openai');
        expect(getProvider()).toBe(openAiCompatibleProvider);

        // The same implementation under its longer name, because "openai" next
        // to AI_BASE_URL=https://api.groq.com/... is a protocol, not a vendor.
        vi.stubEnv('AI_PROVIDER', 'openai-compatible');
        expect(getProvider()).toBe(openAiCompatibleProvider);
    });

    it('is not case- or whitespace-sensitive', () => {
        // `AI_PROVIDER=OpenAI ` in a .env file is a typo that should work, not
        // a silent downgrade to fixtures on a deployment being demoed.
        for (const value of ['OPENAI', 'OpenAI', '  openai  ']) {
            vi.stubEnv('AI_PROVIDER', value);
            expect(getProvider(), value).toBe(openAiCompatibleProvider);
        }

        for (const value of ['MOCK', ' Mock ']) {
            vi.stubEnv('AI_PROVIDER', value);
            expect(getProvider(), value).toBe(mockProvider);
        }
    });

    it('degrades to the mock with a warning on an unknown value', () => {
        // "A typo in an env var should not take the whole app down." The
        // warning is the other half — a silent downgrade on a deployment that
        // meant to call a model is its own bug.
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubEnv('AI_PROVIDER', 'gemini');

        expect(getProvider()).toBe(mockProvider);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('gemini'));
    });

    it('does not throw at import time for any value', () => {
        for (const value of ['', 'mock', 'openai', 'nonsense', '🙂']) {
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            vi.stubEnv('AI_PROVIDER', value);

            expect(() => getProvider(), value).not.toThrow();
        }
    });
});

describe('both implementations satisfy the same interface', () => {
    // The compile-time half is that both files declare `: AiProvider`. This is
    // the runtime half, and it is what catches a method quietly renamed on one
    // side of the seam.
    const implementations: Array<[string, AiProvider]> = [
        ['mock', mockProvider],
        ['openai-compatible', openAiCompatibleProvider],
    ];

    it.each(implementations)('%s exposes all four methods', (_name, provider) => {
        expect(typeof provider.enhancePlan).toBe('function');
        expect(typeof provider.draftPlan).toBe('function');
        expect(typeof provider.generateQuestions).toBe('function');
        expect(typeof provider.feedback).toBe('function');
    });

    it.each(implementations)('%s exposes nothing beyond the interface', (_name, provider) => {
        expect(Object.keys(provider).sort()).toEqual([
            'draftPlan',
            'enhancePlan',
            'feedback',
            'generateQuestions',
        ]);
    });
});

describe('AiUnavailableError', () => {
    it('is an Error with a stable code, so a caller can narrow on it', () => {
        const error = new AiUnavailableError('nothing usable');

        expect(error).toBeInstanceOf(Error);
        expect(error.code).toBe('ai_unavailable');
        expect(error.name).toBe('AiUnavailableError');
        expect(error.message).toBe('nothing usable');
    });

    it('keeps the original failure as its cause', () => {
        // A timeout, a 500, a missing key and a generation that will not parse
        // are one condition to a caller — but the thing that actually happened
        // still has to reach a log.
        const cause = new SyntaxError('Unexpected token < in JSON at position 0');
        const error = new AiUnavailableError('feedback produced nothing usable.', { cause });

        expect(error.cause).toBe(cause);
    });
});
