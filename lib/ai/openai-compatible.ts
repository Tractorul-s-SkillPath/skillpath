/**
 * The generic provider. Reached whenever AI_PROVIDER is not `mock`.
 *
 * Layer: AI
 * Stories: SP-090, SP-094
 *
 * Sketch
 *  openAiCompatibleProvider: AiProvider
 *   - server-side only; AI_API_KEY is never NEXT_PUBLIC_
 *   - 10s timeout per attempt, one retry, then give up
 *   - every response Zod-parsed before it leaves this file
 *   - every failure leaves as AiUnavailableError, never as a raw throw
 *
 * WHY ONE HTTP CLIENT AND NOT A VENDOR SDK. This file replaced an
 * Anthropic-specific provider built on `@anthropic-ai/sdk`, and the trade it
 * makes is deliberate. Everything this application asks a model to do is a
 * prompt in and text or JSON out: no tools, no streaming, no vision, no
 * caching. That is the lowest common denominator of every LLM API, and
 * `POST /chat/completions` is its de facto standard shape — so one
 * implementation reaches OpenAI, Groq, Together, OpenRouter, DeepSeek,
 * Mistral, Ollama, LM Studio and vLLM, on three environment variables and no
 * dependency at all.
 *
 * WHAT THAT COSTS, STATED PLAINLY. The vendor SDK owned the abort timer, the
 * retry policy, the response envelope and the error taxonomy, and this file now
 * owns all four — about forty lines that were previously somebody else's to
 * maintain. It also gives up everything vendor-specific: reasoning-effort
 * controls, prompt caching, and per-vendor stop reasons beyond the two mapped
 * below. None of the three call sites here used any of them.
 *
 * Test: tests/lib/ai/openai-compatible.test.ts (fetch faked — this test is
 * about timeout, retry, mapping and parse behaviour, not about a model)
 */

import 'server-only';
import {
    AI_TIMEOUT_MS,
    AiConfigError,
    assertServerSide,
    capTokens,
    FEEDBACK_MAX_TOKENS,
    PLAN_MAX_TOKENS,
    QUESTIONS_MAX_TOKENS,
    readAiConfig,
    reasoningEffort,
    wantsJsonMode,
    type AiConfig,
} from './guardrails';
import {
    buildDraftPlanPrompt,
    buildEnhancePlanPrompt,
    buildFeedbackPrompt,
    buildGenerateQuestionsPrompt,
} from './prompts';
import {
    draftedPlanSchema,
    draftQuestionsSchema,
    enhancedPlanSchema,
    feedbackResponseSchema,
} from './schemas';
import {
    AiUnavailableError,
    type AiProvider,
    type DraftedPlan,
    type DraftPlanContext,
    type DraftQuestion,
    type EnhancedPlan,
    type FeedbackContext,
    type GenSpec,
    type PlanContext,
} from './provider';

/**
 * One extra attempt, not more.
 *
 * `AI_TIMEOUT_MS` is per attempt, so the ceiling is two of them — and the
 * service races the whole call against the same budget anyway, so a third
 * attempt could never finish inside it. Retrying more would only mean spending
 * money after the caller has already given up and rendered the fallback.
 */
const MAX_RETRIES = 1;

/**
 * What is worth trying again: the failures that are about the moment rather
 * than about the request. A 400 or a 404 will fail identically the second time
 * — a malformed body and a model name that does not exist are not weather.
 */
const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

/** The response envelope, as much of it as this file reads. */
interface ChatCompletion {
    choices?: Array<{
        finish_reason?: string;
        message?: { content?: string | null };
    }>;
}

function config(): AiConfig {
    assertServerSide();

    try {
        return readAiConfig();
    } catch (error) {
        // A misconfiguration and an outage are one condition to the CALLER —
        // there is no usable AI text either way — but the message has to
        // survive, because it is the only thing that tells the person who
        // pasted the variables which one is wrong.
        if (error instanceof AiConfigError) {
            throw new AiUnavailableError(error.message, { cause: error });
        }

        throw error;
    }
}

/** True for the failures worth a second attempt; false for the ones that are settled. */
function isRetryable(error: unknown): boolean {
    if (error instanceof HttpError) return RETRYABLE_STATUSES.has(error.status);

    // A network reset, a DNS blip or our own abort. Not an AiUnavailableError,
    // which by this point means a decision has been made.
    return !(error instanceof AiUnavailableError);
}

/** Carries the status through the retry decision. Never leaves this file. */
class HttpError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = 'HttpError';
    }
}

/**
 * One request, with its own deadline.
 *
 * `AbortSignal.timeout` rather than a hand-rolled `setTimeout` and controller:
 * it is the platform's own version of exactly this, it cannot leak a handle,
 * and it aborts the socket rather than merely stopping the wait — which is the
 * difference between a timeout that saves money and one that only saves time.
 */
async function post(prompt: string, maxTokens: number, json: boolean): Promise<Response> {
    const { baseUrl, apiKey, model } = config();
    const effort = reasoningEffort();

    return fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
            // Asked for only where the answer really is JSON. Sending it on the
            // feedback call would be asking a provider to wrap one sentence in
            // an object, which is a parse failure waiting to happen.
            ...(json && wantsJsonMode() ? { response_format: { type: 'json_object' } } : {}),
            // On EVERY call, unlike response_format: that one is about the
            // shape of one answer, this one is about the deadline, and all
            // three calls share AI_TIMEOUT_MS.
            ...(effort ? { reasoning_effort: effort } : {}),
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
}

/** One call, and the only place a response is turned back into a string. */
async function ask(prompt: string, requestedTokens: number, json: boolean): Promise<string> {
    const maxTokens = capTokens(requestedTokens);

    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await post(prompt, maxTokens, json);

            if (!response.ok) {
                // The body often carries the only useful sentence — "model not
                // found", "insufficient quota" — and it is the difference
                // between a fixable mistake and a mystery in a log.
                const detail = await response.text().catch(() => '');
                throw new HttpError(
                    response.status,
                    `${response.status} ${response.statusText}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
                );
            }

            return readAnswer(await response.json(), maxTokens);
        } catch (error) {
            lastError = error;

            if (attempt === MAX_RETRIES || !isRetryable(error)) break;
        }
    }

    if (lastError instanceof AiUnavailableError) throw lastError;

    throw new AiUnavailableError('The provider did not answer.', { cause: lastError });
}

/**
 * The envelope, unwrapped — and the two stop reasons that are failures.
 *
 * `finish_reason` IS THE ANTHROPIC `stop_reason` CHECK, PORTED. That check was
 * added because truncation is not a short answer: `max_tokens` cuts the
 * generation mid-token, and while a cut JSON body merely fails to parse, a cut
 * PARAGRAPH is still 1-1500 characters and satisfies feedbackResponseSchema.
 * ai.service would then persist it to assessments.ai_feedback, where §6.4
 * guarantees it is never regenerated — a sentence that stops halfway would be
 * that member's feedback for ever. The field is named differently here; the
 * failure is identical.
 */
function readAnswer(body: ChatCompletion, maxTokens: number): string {
    const choice = body.choices?.[0];

    if (!choice) throw new AiUnavailableError('The provider returned no choices.');

    if (choice.finish_reason === 'length') {
        throw new AiUnavailableError(`The model hit the ${maxTokens}-token ceiling mid-answer.`);
    }

    if (choice.finish_reason === 'content_filter') {
        throw new AiUnavailableError('The model declined to answer.');
    }

    const text = choice.message?.content?.trim();

    if (!text) throw new AiUnavailableError('The model returned no text.');

    return text;
}

/**
 * Run it, and let nothing out untyped.
 *
 * This is the point of the wrapper: a JSON.parse SyntaxError, a ZodError and a
 * 500 are all "no usable text" to the caller, and §6.1 says a malformed
 * generation is a caught error rather than something a page has to recognise.
 */
async function guarded<T>(label: string, run: () => Promise<T>): Promise<T> {
    try {
        return await run();
    } catch (error) {
        if (error instanceof AiUnavailableError) throw error;

        console.error(`[ai] ${label} failed:`, error);
        throw new AiUnavailableError(`${label} produced nothing usable.`, { cause: error });
    }
}

/**
 * Every prompt here ends with "reply with JSON only, and nothing else", and a
 * model will still sometimes wrap the answer in a ```json fence. That is not a
 * malformed generation — the JSON inside it is exactly what was asked for — but
 * JSON.parse cannot see past the first backtick, so it arrives as a total
 * failure and the whole feature degrades over punctuation.
 *
 * It matters more here than it did behind a single vendor: `response_format`
 * is honoured by most OpenAI-compatible backends and not all, and a local
 * runtime that ignores it is exactly the one most likely to fence its output.
 *
 * Narrow on purpose: it removes an opening fence and its optional language tag
 * and a closing fence, and does nothing else. It does not hunt for the first
 * `{` in the string — that would start "repairing" output, and repaired model
 * output is exactly the thing §6.1 says not to trust.
 */
function stripCodeFence(raw: string): string {
    const fenced = /^```(?:[a-zA-Z]+)?\s*\n([\s\S]*?)\n?```$/.exec(raw.trim());

    return fenced ? fenced[1].trim() : raw;
}

/** Model output is untrusted input. This is the only door it comes through. */
function parseJson(raw: string, label: string): unknown {
    try {
        return JSON.parse(stripCodeFence(raw));
    } catch (error) {
        throw new AiUnavailableError(`${label} did not return JSON.`, { cause: error });
    }
}

export const openAiCompatibleProvider: AiProvider = {
    async enhancePlan(input: PlanContext): Promise<EnhancedPlan> {
        return guarded('enhancePlan', async () => {
            const raw = await ask(
                buildEnhancePlanPrompt({
                    firstName: input.firstName,
                    score: Math.round(input.score),
                    topics: input.topics,
                }),
                PLAN_MAX_TOKENS,
                true,
            );

            return enhancedPlanSchema.parse(parseJson(raw, 'enhancePlan'));
        });
    },

    async draftPlan(input: DraftPlanContext): Promise<DraftedPlan> {
        return guarded('draftPlan', async () => {
            const raw = await ask(
                buildDraftPlanPrompt({
                    firstName: input.firstName,
                    score: Math.round(input.score),
                    runLabel: input.runLabel,
                    missed: input.missed,
                }),
                // The same budget as enhancePlan, and for the same reason: this
                // answer is the longer of the two if anything, since the model
                // writes the titles as well as the paragraphs.
                PLAN_MAX_TOKENS,
                true,
            );

            return draftedPlanSchema.parse(parseJson(raw, 'draftPlan'));
        });
    },

    async generateQuestions(spec: GenSpec): Promise<DraftQuestion[]> {
        return guarded('generateQuestions', async () => {
            const raw = await ask(
                buildGenerateQuestionsPrompt({
                    categoryName: spec.categoryName,
                    difficulty: spec.difficulty,
                    count: spec.count,
                }),
                QUESTIONS_MAX_TOKENS,
                // JSON mode wants an OBJECT at the root and this prompt asks for
                // an array, which some backends refuse outright. The prompt and
                // the fence-stripper carry this one.
                false,
            );

            return draftQuestionsSchema.parse(parseJson(raw, 'generateQuestions'));
        });
    },

    async feedback(input: FeedbackContext): Promise<string> {
        return guarded('feedback', async () => {
            const raw = await ask(
                buildFeedbackPrompt({
                    firstName: input.firstName,
                    score: Math.round(input.score),
                    weakAreas: input.weakAreas,
                }),
                FEEDBACK_MAX_TOKENS,
                false,
            );

            // Plain text, so there is nothing to JSON.parse — but the length
            // bound still applies, and it is the same one the column has.
            return feedbackResponseSchema.parse(raw);
        });
    },
};
