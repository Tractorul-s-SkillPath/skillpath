/**
 * Tests for lib/ai/openai-compatible.ts, with fetch faked.
 *
 * Stories: SP-090, SP-094
 *
 * Cases
 *  - the request goes to <base>/chat/completions with a bearer key
 *  - each call carries its own max-token budget; JSON mode only where it fits
 *  - finish_reason 'length' and 'content_filter' both leave as ai_unavailable
 *  - a retryable status is retried once, a settled one is not
 *  - malformed JSON -> a typed ai_unavailable error, never a raw throw
 *  - a ```json fence is tolerated rather than treated as a failure
 *  - a missing or malformed variable names ITSELF in the message
 *
 * WHAT IS AND IS NOT TESTED HERE. `fetch` is replaced wholesale, so this file
 * is about the contract this code owns: what it sends, what it does with what
 * comes back, and that nothing leaves untyped. There is no live endpoint in
 * it and there is not meant to be — the suite runs offline, and AI_PROVIDER is
 * pinned to `mock` everywhere else.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openAiCompatibleProvider } from '../../../lib/ai/openai-compatible';
import {
    FEEDBACK_MAX_TOKENS,
    PLAN_MAX_TOKENS,
    QUESTIONS_MAX_TOKENS,
} from '../../../lib/ai/guardrails';
import { AiUnavailableError } from '../../../lib/ai/provider';

const fetchMock = vi.fn();

/** A chat-completion envelope, in the shape `readAnswer` reads. */
function aResponse(text: string, finishReason: string = 'stop') {
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
            choices: [{ finish_reason: finishReason, message: { content: text } }],
        }),
        text: async () => '',
    };
}

function anError(status: number, body = 'upstream said no') {
    return {
        ok: false,
        status,
        statusText: 'Error',
        json: async () => ({}),
        text: async () => body,
    };
}

const A_PLAN = {
    firstName: 'Ana',
    score: 62.4,
    topics: [{ topicTitle: 'Indexes', ruleDescription: 'Read up on B-trees.' }],
};

const A_SPEC = { categoryName: 'Databases', difficulty: 'intermediate' as const, count: 2 };

const A_FEEDBACK = { firstName: 'Ana', score: 62.4, weakAreas: ['Indexes'] };

const A_VALID_PLAN_BODY = JSON.stringify({
    items: [{ topicTitle: 'Indexes', aiDescription: 'Worth doing before anything harder.' }],
});

const A_VALID_QUESTIONS_BODY = JSON.stringify([
    {
        question: 'Which index type does Postgres create by default?',
        options: ['B-tree', 'Hash', 'GiST', 'BRIN'],
        correctAnswer: 'B-tree',
    },
]);

/** The last request, url and parsed body together. */
function lastCall() {
    const [url, init] = fetchMock.mock.calls.at(-1)!;

    return { url, init, body: JSON.parse(init.body as string) };
}

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    vi.stubEnv('AI_BASE_URL', 'https://api.example.com/v1');
    vi.stubEnv('AI_API_KEY', 'sk-test-key');
    vi.stubEnv('AI_MODEL', 'some-model');
    vi.stubEnv('AI_JSON_MODE', undefined);
    vi.stubEnv('AI_REASONING_EFFORT', undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('configuration', () => {
    it('names the variable that is missing, rather than failing vaguely', async () => {
        // The papercut this closes: a missing key used to arrive as one
        // console.error per request inside a path designed to swallow failure,
        // so the app looked like it worked and quietly served rule-based text.
        vi.stubEnv('AI_API_KEY', undefined);

        await expect(openAiCompatibleProvider.feedback(A_FEEDBACK)).rejects.toThrow(
            /AI_API_KEY .* not set/,
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('lists every missing variable at once', async () => {
        vi.stubEnv('AI_BASE_URL', undefined);
        vi.stubEnv('AI_MODEL', undefined);

        const failure = await openAiCompatibleProvider.feedback(A_FEEDBACK).catch((e) => e);

        expect(failure.message).toContain('AI_BASE_URL');
        expect(failure.message).toContain('AI_MODEL');
        expect(failure.message).toContain('are not set');
    });

    it('rejects a base URL with no scheme, which fetch reports uselessly', async () => {
        vi.stubEnv('AI_BASE_URL', 'api.example.com/v1');

        await expect(openAiCompatibleProvider.feedback(A_FEEDBACK)).rejects.toThrow(
            /must start with http/,
        );
    });

    it('survives the three ways a pasted value arrives wrong', async () => {
        // A trailing newline from an editor, quotes copied out of an example,
        // and an indented paste. Each produces a value that is subtly wrong
        // rather than obviously absent: a key with a newline is a 401 that
        // reads like a revoked key.
        vi.stubEnv('AI_API_KEY', '  "sk-test-key"\n');
        vi.stubEnv('AI_BASE_URL', "'https://api.example.com/v1/'  ");
        vi.stubEnv('AI_MODEL', ' some-model ');
        fetchMock.mockResolvedValue(aResponse('Nice work, Ana.'));

        await openAiCompatibleProvider.feedback(A_FEEDBACK);

        const { url, init, body } = lastCall();
        expect(url).toBe('https://api.example.com/v1/chat/completions');
        expect(init.headers.authorization).toBe('Bearer sk-test-key');
        expect(body.model).toBe('some-model');
    });

    it('never produces a double slash from a trailing one', async () => {
        vi.stubEnv('AI_BASE_URL', 'https://api.example.com/v1///');
        fetchMock.mockResolvedValue(aResponse('Nice work, Ana.'));

        await openAiCompatibleProvider.feedback(A_FEEDBACK);

        expect(lastCall().url).toBe('https://api.example.com/v1/chat/completions');
    });
});

describe('what each call sends', () => {
    it('gives each task its own token budget (SP-094)', async () => {
        fetchMock.mockResolvedValue(aResponse(A_VALID_PLAN_BODY));
        await openAiCompatibleProvider.enhancePlan(A_PLAN);
        expect(lastCall().body.max_tokens).toBe(PLAN_MAX_TOKENS);

        fetchMock.mockResolvedValue(aResponse(A_VALID_QUESTIONS_BODY));
        await openAiCompatibleProvider.generateQuestions(A_SPEC);
        expect(lastCall().body.max_tokens).toBe(QUESTIONS_MAX_TOKENS);

        fetchMock.mockResolvedValue(aResponse('Nice work, Ana.'));
        await openAiCompatibleProvider.feedback(A_FEEDBACK);
        expect(lastCall().body.max_tokens).toBe(FEEDBACK_MAX_TOKENS);
    });

    it('asks for JSON mode on the plan and not on the other two', async () => {
        // The plan's answer is an OBJECT, which is what json_object means. The
        // questions prompt asks for an array at the root, which some backends
        // refuse under that flag, and the feedback answer is a bare sentence —
        // asking a model to wrap one sentence in an object is a parse failure
        // waiting to happen.
        fetchMock.mockResolvedValue(aResponse(A_VALID_PLAN_BODY));
        await openAiCompatibleProvider.enhancePlan(A_PLAN);
        expect(lastCall().body.response_format).toEqual({ type: 'json_object' });

        fetchMock.mockResolvedValue(aResponse(A_VALID_QUESTIONS_BODY));
        await openAiCompatibleProvider.generateQuestions(A_SPEC);
        expect(lastCall().body.response_format).toBeUndefined();

        fetchMock.mockResolvedValue(aResponse('Nice work, Ana.'));
        await openAiCompatibleProvider.feedback(A_FEEDBACK);
        expect(lastCall().body.response_format).toBeUndefined();
    });

    it('drops JSON mode when AI_JSON_MODE is off, for backends that reject it', async () => {
        vi.stubEnv('AI_JSON_MODE', 'false');
        fetchMock.mockResolvedValue(aResponse(A_VALID_PLAN_BODY));

        await openAiCompatibleProvider.enhancePlan(A_PLAN);

        expect(lastCall().body.response_format).toBeUndefined();
    });

    it('sends no reasoning_effort unless one is configured', async () => {
        fetchMock.mockResolvedValue(aResponse(A_VALID_PLAN_BODY));

        await openAiCompatibleProvider.enhancePlan(A_PLAN);

        expect(lastCall().body.reasoning_effort).toBeUndefined();
    });

    it('sends reasoning_effort on every call, because the deadline is shared', async () => {
        // Unlike response_format, which is per answer-shape. A model that
        // thinks for sixteen seconds misses AI_TIMEOUT_MS on the plan first,
        // but it is the same clock on all three.
        vi.stubEnv('AI_REASONING_EFFORT', 'none');

        fetchMock.mockResolvedValue(aResponse(A_VALID_PLAN_BODY));
        await openAiCompatibleProvider.enhancePlan(A_PLAN);
        expect(lastCall().body.reasoning_effort).toBe('none');

        fetchMock.mockResolvedValue(aResponse('Nice work, Ana.'));
        await openAiCompatibleProvider.feedback(A_FEEDBACK);
        expect(lastCall().body.reasoning_effort).toBe('none');

        fetchMock.mockResolvedValue(aResponse(A_VALID_QUESTIONS_BODY));
        await openAiCompatibleProvider.generateQuestions(A_SPEC);
        expect(lastCall().body.reasoning_effort).toBe('none');
    });

    it('sends one user message and an abort signal', async () => {
        fetchMock.mockResolvedValue(aResponse('Nice work, Ana.'));

        await openAiCompatibleProvider.feedback(A_FEEDBACK);

        const { init, body } = lastCall();
        expect(body.messages).toEqual([{ role: 'user', content: expect.any(String) }]);
        expect(init.signal).toBeInstanceOf(AbortSignal);
        expect(init.method).toBe('POST');
    });

    it('rounds the score before it reaches the prompt', async () => {
        // total_score is numeric(5,2) and a 15-question paper produces 66.67,
        // which no one wants read back to them.
        fetchMock.mockResolvedValue(aResponse('Nice work, Ana.'));

        await openAiCompatibleProvider.feedback(A_FEEDBACK);

        expect(lastCall().body.messages[0].content).toContain('62%');
        expect(lastCall().body.messages[0].content).not.toContain('62.4');
    });
});

describe('retrying', () => {
    it('retries a 503 once and succeeds on the second attempt', async () => {
        fetchMock
            .mockResolvedValueOnce(anError(503))
            .mockResolvedValueOnce(aResponse('Nice work, Ana.'));

        await expect(openAiCompatibleProvider.feedback(A_FEEDBACK)).resolves.toBe(
            'Nice work, Ana.',
        );
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('gives up after exactly one retry', async () => {
        // AI_TIMEOUT_MS is per attempt and the service races the whole call
        // against the same budget, so a third attempt could never finish inside
        // it — it would only spend money after the caller gave up.
        fetchMock.mockResolvedValue(anError(500));

        await expect(openAiCompatibleProvider.feedback(A_FEEDBACK)).rejects.toThrow(
            AiUnavailableError,
        );
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries a network failure', async () => {
        fetchMock
            .mockRejectedValueOnce(new TypeError('fetch failed'))
            .mockResolvedValueOnce(aResponse('Nice work, Ana.'));

        await expect(openAiCompatibleProvider.feedback(A_FEEDBACK)).resolves.toBe(
            'Nice work, Ana.',
        );
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does NOT retry a 400 or a 404', async () => {
        // A malformed body and a model name that does not exist are not
        // weather. They will fail identically the second time, and retrying
        // only doubles the latency in front of the fallback.
        for (const status of [400, 401, 403, 404]) {
            fetchMock.mockReset();
            fetchMock.mockResolvedValue(anError(status));

            await expect(openAiCompatibleProvider.feedback(A_FEEDBACK)).rejects.toThrow(
                AiUnavailableError,
            );
            expect(fetchMock, `status ${status}`).toHaveBeenCalledTimes(1);
        }
    });

    it('keeps the upstream sentence, which is often the only useful one', async () => {
        fetchMock.mockResolvedValue(anError(404, '{"error":{"message":"model not found"}}'));

        const failure = await openAiCompatibleProvider.feedback(A_FEEDBACK).catch((e) => e);

        expect(String(failure.cause?.message ?? failure.message)).toContain('model not found');
    });
});

describe('what comes back is never trusted', () => {
    it('turns a TRUNCATED feedback paragraph into a typed error', async () => {
        // THE REGRESSION THIS FILE INHERITED. finish_reason 'length' is the
        // OpenAI-shaped name for the Anthropic stop_reason 'max_tokens' check.
        // A cut JSON body merely fails to parse; a cut PARAGRAPH is still
        // 1-1500 characters, satisfies feedbackResponseSchema, and ai.service
        // would persist it to assessments.ai_feedback — where §6.4 guarantees
        // it is never regenerated. A sentence that stops halfway would be that
        // member's feedback for ever.
        fetchMock.mockResolvedValue(
            aResponse('You scored 62%. The quickest way up from here is ind', 'length'),
        );

        await expect(openAiCompatibleProvider.feedback(A_FEEDBACK)).rejects.toThrow(
            /ceiling mid-answer/,
        );
    });

    it('turns a truncated plan and question batch into typed errors too', async () => {
        fetchMock.mockResolvedValue(aResponse('{"items":[{"topicTitle":"Ind', 'length'));
        await expect(openAiCompatibleProvider.enhancePlan(A_PLAN)).rejects.toThrow(
            AiUnavailableError,
        );

        fetchMock.mockResolvedValue(aResponse('[{"question":"Which ind', 'length'));
        await expect(openAiCompatibleProvider.generateQuestions(A_SPEC)).rejects.toThrow(
            AiUnavailableError,
        );
    });

    it('turns a content filter into a typed error', async () => {
        fetchMock.mockResolvedValue(aResponse('', 'content_filter'));

        await expect(openAiCompatibleProvider.feedback(A_FEEDBACK)).rejects.toThrow(
            /declined to answer/,
        );
    });

    it('rejects an empty choices array and an empty message', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ choices: [] }),
            text: async () => '',
        });
        await expect(openAiCompatibleProvider.feedback(A_FEEDBACK)).rejects.toThrow(/no choices/);

        fetchMock.mockResolvedValue(aResponse('   '));
        await expect(openAiCompatibleProvider.feedback(A_FEEDBACK)).rejects.toThrow(/no text/);
    });

    it('turns malformed JSON into a typed error, never a raw SyntaxError', async () => {
        fetchMock.mockResolvedValue(aResponse('Sure! Here is your plan: it is a good one.'));

        const failure = await openAiCompatibleProvider.enhancePlan(A_PLAN).catch((e) => e);

        expect(failure).toBeInstanceOf(AiUnavailableError);
        expect(failure).not.toBeInstanceOf(SyntaxError);
        expect(failure.message).toMatch(/did not return JSON/);
        expect(failure.cause).toBeInstanceOf(SyntaxError);
    });

    it('rejects well-formed JSON that breaks the schema', async () => {
        fetchMock.mockResolvedValue(
            aResponse(
                JSON.stringify({
                    items: [{ topicTitle: 'Indexes', aiDescription: 'x'.repeat(700) }],
                }),
            ),
        );

        await expect(openAiCompatibleProvider.enhancePlan(A_PLAN)).rejects.toThrow(
            AiUnavailableError,
        );
    });

    it('rejects a question whose key is not one of its options', async () => {
        fetchMock.mockResolvedValue(
            aResponse(
                JSON.stringify([
                    {
                        question: 'A?',
                        options: ['Choice A', 'Choice B'],
                        correctAnswer: 'Choice Z',
                    },
                ]),
            ),
        );

        await expect(openAiCompatibleProvider.generateQuestions(A_SPEC)).rejects.toThrow(
            AiUnavailableError,
        );
    });

    it('rejects feedback past the length bound', async () => {
        fetchMock.mockResolvedValue(aResponse('x'.repeat(1501)));

        await expect(openAiCompatibleProvider.feedback(A_FEEDBACK)).rejects.toThrow(
            AiUnavailableError,
        );
    });
});

describe('the happy path', () => {
    it('parses a plan, questions and feedback', async () => {
        fetchMock.mockResolvedValue(aResponse(A_VALID_PLAN_BODY));
        await expect(openAiCompatibleProvider.enhancePlan(A_PLAN)).resolves.toEqual({
            items: [
                { topicTitle: 'Indexes', aiDescription: 'Worth doing before anything harder.' },
            ],
        });

        fetchMock.mockResolvedValue(aResponse(A_VALID_QUESTIONS_BODY));
        await expect(openAiCompatibleProvider.generateQuestions(A_SPEC)).resolves.toHaveLength(1);

        fetchMock.mockResolvedValue(aResponse('Ana — you scored 62%. Start with indexes.'));
        await expect(openAiCompatibleProvider.feedback(A_FEEDBACK)).resolves.toBe(
            'Ana — you scored 62%. Start with indexes.',
        );
    });

    it('tolerates a ```json fence around the body', async () => {
        // It matters more here than behind a single vendor: response_format is
        // honoured by most OpenAI-compatible backends and not all, and a local
        // runtime that ignores it is exactly the one most likely to fence.
        fetchMock.mockResolvedValue(aResponse('```json\n' + A_VALID_PLAN_BODY + '\n```'));

        await expect(openAiCompatibleProvider.enhancePlan(A_PLAN)).resolves.toMatchObject({
            items: [{ topicTitle: 'Indexes' }],
        });
    });

    it('tolerates an unlabelled fence with padding around it', async () => {
        fetchMock.mockResolvedValue(aResponse('  ```\n' + A_VALID_QUESTIONS_BODY + '\n```  '));

        await expect(openAiCompatibleProvider.generateQuestions(A_SPEC)).resolves.toHaveLength(1);
    });

    it('does not go hunting for JSON inside prose', async () => {
        // The line between tolerating a fence and REPAIRING output. Repaired
        // model output is exactly the thing §6.1 says not to trust.
        fetchMock.mockResolvedValue(
            aResponse(`Here is the plan you asked for:\n${A_VALID_PLAN_BODY}\nHope that helps!`),
        );

        await expect(openAiCompatibleProvider.enhancePlan(A_PLAN)).rejects.toThrow(
            /did not return JSON/,
        );
    });
});
