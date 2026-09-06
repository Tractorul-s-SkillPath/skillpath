/**
 * AI safety and cost guardrails.
 *
 * Layer: AI
 * Story: SP-094
 *
 * Sketch
 *  isAiEnabled()               - the master switch AC3 of SP-093 refers to
 *  readAiConfig()              - base URL, key and model, cleaned and checked
 *  MAX_TOKENS_PER_REQUEST      - the documented per-request ceiling
 *  FEEDBACK/PLAN/QUESTIONS_MAX_TOKENS - what each task actually needs
 *  capTokens(requested)        - every call site goes through this
 *  firstNameOnly(name)         - a first name and nothing after it
 *  rateLimit(userId, key)      - per member, per window
 *  RateLimitedError            - the one failure a caller CAN act on
 *  assertServerSide()          - a model call may never originate in a browser
 *
 * Test: tests/lib/ai/guardrails.test.ts
 */

/**
 * The ceiling, in output tokens, on any single generation.
 *
 * A ceiling rather than a budget: a call site asks for what it needs and
 * capTokens clamps it, so raising the ceiling is a deliberate one-line change
 * here and not something a new feature does by quietly passing a bigger number.
 */
export const MAX_TOKENS_PER_REQUEST = 4096;

/**
 * WHY ONE CEILING IS NOT ENOUGH, AND WHAT EACH TASK GETS.
 *
 * These three used to be one number passed by all three call sites. That is
 * comfortable for feedback and much too tight for a plan, and the failure it
 * produced was invisible: a 20-question baseline can miss twenty topics, the
 * prompt asks for up to 400 characters on each, and the generation was cut
 * mid-string, the JSON stopped parsing, and the whole plan silently lost its
 * elaboration — worst for the lowest-scoring member, who has the most rows.
 *
 * So the budget follows the shape of the answer:
 *
 *  FEEDBACK   two or three sentences, bounded at 500 characters by the prompt.
 *  PLAN       up to 30 items x 400 characters, plus titles and JSON.
 *  QUESTIONS  up to GENERATE_COUNT_MAX questions x 4 options, plus JSON.
 *
 * THESE CAME DOWN WHEN THE PROVIDER WENT GENERIC, and the reason is worth
 * keeping. They were sized for a provider whose `max_tokens` covered the
 * model's REASONING as well as its answer, so most of the budget was headroom
 * for thinking nobody could see. A plain chat completion spends its budget on
 * the answer alone, so the same safety margin costs a quarter as much. If you
 * point AI_BASE_URL at a reasoning model that bills thinking against this
 * number, raise them back — that is the one deployment where these are tight.
 *
 * Truncation is DETECTED rather than merely made unlikely — see the
 * finish_reason check in openai-compatible.ts. These numbers keep it rare;
 * that check is what keeps a truncated generation from being persisted as if
 * it were whole.
 */
export const FEEDBACK_MAX_TOKENS = 1024;
export const PLAN_MAX_TOKENS = 4096;
export const QUESTIONS_MAX_TOKENS = 3072;

/**
 * How long any AI call may take before the caller stops waiting (§6).
 *
 * Enforced twice on purpose. The provider hands it to `AbortSignal.timeout`,
 * which is the only layer that can actually abort the request. The service
 * races the whole call against it as well, because the AiProvider INTERFACE
 * makes no promise about timeouts — the mock can be told to hang, a future
 * provider might not abort at all, and "degrade, never block" has to hold for
 * any implementation, not just the well-behaved one.
 */
export const AI_TIMEOUT_MS = 10_000;

/** How long a member's allowance lasts before it resets. */
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/** Generations one member may ask for inside a window. */
const MAX_REQUESTS_PER_WINDOW = 10;

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Whether to call a provider at all.
 *
 * Separate from AI_PROVIDER because "off" and "which one" are different
 * questions: AI_PROVIDER=mock still generates text, it just does not spend
 * money doing it, which is what CI wants. AI_ENABLED=false is the demo-day
 * switch and the SP-093 AC3 path — nothing is called, and every AI surface
 * renders its rule-based text.
 *
 * Absent means enabled, so no deployment breaks by not knowing about this.
 */
export function isAiEnabled(): boolean {
    const raw = process.env.AI_ENABLED?.trim().toLowerCase();
    if (raw === undefined || raw === '') return true;

    return !['false', '0', 'off', 'no'].includes(raw);
}

/**
 * A misconfigured provider, told apart from a broken one.
 *
 * Its own type because the two need different sentences and, more to the point,
 * different readers. "The model is down" is for a log nobody reads at 3am; "you
 * have not set AI_API_KEY" is for the person who just pasted three environment
 * variables and is looking at rule-based text wondering why.
 */
export class AiConfigError extends Error {
    readonly code = 'ai_misconfigured' as const;

    constructor(message: string) {
        super(message);
        this.name = 'AiConfigError';
    }
}

/** Everything the generic provider needs to reach a model. */
export interface AiConfig {
    /** No trailing slash. `/chat/completions` is appended to it. */
    baseUrl: string;
    apiKey: string;
    model: string;
}

/**
 * A pasted value, as it was meant rather than as it arrived.
 *
 * Three things happen to every environment variable people type by hand, and
 * all three produce a value that is subtly wrong rather than obviously absent:
 * a trailing newline from an editor, surrounding quotes copied out of a `.env`
 * example, and leading whitespace from an indented paste. A key with a newline
 * on the end is a 401 that reads like a revoked key; a URL with quotes around
 * it is a DNS failure that reads like an outage.
 */
function clean(raw: string | undefined): string {
    const trimmed = raw?.trim() ?? '';

    const unquoted =
        trimmed.length >= 2 &&
        ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'")))
            ? trimmed.slice(1, -1).trim()
            : trimmed;

    return unquoted;
}

/**
 * The three variables the generic provider runs on, cleaned and checked.
 *
 * WHY THIS THROWS RATHER THAN DEFAULTING. There is no sensible default for any
 * of the three: a guessed base URL points at somebody else's bill, a guessed
 * model is a 404 on every call, and there is no such thing as a default API
 * key. The one thing worse than refusing to start is starting and quietly
 * producing rule-based text for a week — which is exactly what the old code did
 * when a key was missing, because the failure arrived as one console.error per
 * request inside a path designed to swallow failure.
 *
 * The message names the variable. That is the whole point of the function: a
 * person who has just pasted three values and got the fallback text should be
 * able to read one line and know which one is wrong.
 */
export function readAiConfig(): AiConfig {
    const baseUrl = clean(process.env.AI_BASE_URL);
    const apiKey = clean(process.env.AI_API_KEY);
    const model = clean(process.env.AI_MODEL);

    const missing = [
        ['AI_BASE_URL', baseUrl],
        ['AI_API_KEY', apiKey],
        ['AI_MODEL', model],
    ]
        .filter(([, value]) => !value)
        .map(([name]) => name);

    if (missing.length > 0) {
        throw new AiConfigError(
            `AI_PROVIDER is not \`mock\`, but ${missing.join(', ')} ${
                missing.length === 1 ? 'is' : 'are'
            } not set. Set ${missing.length === 1 ? 'it' : 'them'} or use AI_PROVIDER=mock.`,
        );
    }

    if (!/^https?:\/\//.test(baseUrl)) {
        // Caught here because fetch() reports it as a TypeError with no useful
        // message, which reads like a bug in this file rather than a typo in
        // an environment variable.
        throw new AiConfigError(
            `AI_BASE_URL must start with http:// or https:// — got "${baseUrl}".`,
        );
    }

    return {
        // A trailing slash would produce `//chat/completions`, which some
        // gateways route and others 404. Normalised once, here.
        baseUrl: baseUrl.replace(/\/+$/, ''),
        apiKey,
        model,
    };
}

/**
 * Whether to ask the endpoint for JSON explicitly.
 *
 * `response_format: {type: "json_object"}` is the OpenAI-compatible way to say
 * "the body must parse", and most backends behind that shape honour it. Most,
 * not all: a few older or partial implementations reject the unknown field with
 * a 400, which would take the feature down on a provider that works perfectly
 * well without it. So it is on by default and switchable off, and the prompt
 * still asks for JSON in words either way.
 */
export function wantsJsonMode(): boolean {
    const raw = process.env.AI_JSON_MODE?.trim().toLowerCase();
    if (raw === undefined || raw === '') return true;

    return !['false', '0', 'off', 'no'].includes(raw);
}

/** The efforts the OpenAI protocol defines, plus `none` for "do not think at all". */
const REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high'] as const;

export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

/**
 * How hard the model is asked to think before it answers — or nothing at all.
 *
 * `reasoning_effort` is the OpenAI protocol's own field, so this stays as
 * vendor-neutral as the rest of the folder. What it buys is LATENCY rather than
 * shape, and on a reasoning model that is the difference between a feature and
 * an empty column: those tokens are spent before the first token of the answer,
 * `max_tokens` does not bound them, and none of them come back in the reply.
 *
 * The twenty-topic plan is the call that notices, being the longest of the
 * three. Measured against one thinking-by-default model it spent 2,566 hidden
 * tokens and 16s on a generation whose answer took 1,298 — past AI_TIMEOUT_MS,
 * so every plan was aborted, `enhancePlan` logged one line and every member got
 * the rule text with no error anywhere on the page. `none` returned the same
 * call, complete, in 5s.
 *
 * UNSET MEANS SEND NOTHING, which is the only safe default: the field is
 * meaningless to a model that does not reason and a 400 on a backend that has
 * never heard of it. `none` is not the portable floor either — some models take
 * it and some answer a bare `400 Request contains an invalid argument` that
 * names no field — which is why every documented value is allowed through
 * rather than the two anyone would guess.
 *
 * An unrecognised value is warned about and dropped rather than forwarded. A
 * typo here would otherwise 400 every AI call at once, which reads like a
 * revoked key rather than like one wrong word in one variable.
 */
export function reasoningEffort(): ReasoningEffort | undefined {
    const raw = process.env.AI_REASONING_EFFORT?.trim().toLowerCase();
    if (raw === undefined || raw === '') return undefined;

    const known = REASONING_EFFORTS.find((effort) => effort === raw);

    if (!known) {
        console.warn(
            `[ai] unknown AI_REASONING_EFFORT "${raw}" — sending none. Expected one of ${REASONING_EFFORTS.join(', ')}.`,
        );
        return undefined;
    }

    return known;
}

/** The one place a max_tokens value is decided. Never pass a raw number to a provider. */
export function capTokens(requested: number): number {
    if (!Number.isFinite(requested) || requested <= 0) return MAX_TOKENS_PER_REQUEST;

    return Math.min(Math.floor(requested), MAX_TOKENS_PER_REQUEST);
}

/**
 * A first name, and nothing after it.
 *
 * A first name is the first whitespace-separated token, so "Ana Maria Popescu"
 * contributes "Ana" and never a surname a prompt could echo back into text we
 * store and render. `profiles.first_name` is a free-text column an admin or a
 * member can type a full name into, so the narrow types on PlanContext and
 * FeedbackContext keep a caller from passing an email or a user id, and this
 * keeps a caller from passing a whole name in the one field that IS allowed.
 *
 * THIS REPLACES scrubContext, WHICH WAS NEVER CALLED. That function took a
 * whole profile row and returned `{name?, scores?}` — a shape no caller in this
 * codebase has, since ai.service passes a first name and a score separately. So
 * it sat in this file being cited by the header, by lib/ai/README.md and by a
 * test docblock as the enforcement point for SP-094 while enforcing nothing.
 * A security control that is documented but not called is worse than an absent
 * one, because the next person reads the citation and stops looking. This one
 * is called: ai.service applies it at both entry points.
 */
export function firstNameOnly(name?: string): string | undefined {
    const first = name?.trim().split(/\s+/)[0];

    return first ? first : undefined;
}

/**
 * The one AI failure a caller can do something about.
 *
 * Everything else — a timeout, a 500, a refusal, a body that will not parse —
 * is "there is no usable AI text right now", and the answer to all of them is
 * the same: degrade. Waiting is a real, correct next step, and an admin who is
 * told "generation failed, try again" retries immediately and fails again. Its
 * own type so ai.service can say the true thing instead.
 */
export class RateLimitedError extends Error {
    readonly code = 'rate_limited' as const;

    constructor(message: string) {
        super(message);
        this.name = 'RateLimitedError';
    }
}

/**
 * Spend one of this member's generations, or refuse.
 *
 * In-memory, so it resets on deploy and does not survive a second instance —
 * which is honest for what it is: a stop on one member looping a page, not a
 * defence against a distributed attacker. `key` separates the budgets, so an
 * admin generating questions cannot exhaust their own feedback allowance.
 *
 * Throws rather than returning false: forgetting to check a boolean is silent,
 * and the callers all sit inside a try that degrades to rule-based text anyway.
 *
 * EXPIRED ENTRIES ARE SWEPT, because nothing else would ever remove them. The
 * map is keyed by `${userId}:${key}` and a long-lived server meets an unbounded
 * number of members, so without this it grows by one entry per member per
 * feature and never shrinks. The sweep is amortised onto the calls themselves
 * rather than an interval: this map is only ever touched here, there are at
 * most a few hundred live entries at any moment, and a timer would keep a
 * handle open in every test file that imports this module.
 */
export function rateLimit(userId: string, key: string = 'default'): void {
    const trackerKey = `${userId}:${key}`;
    const now = Date.now();

    for (const [existingKey, record] of rateLimitMap) {
        if (now > record.resetTime) rateLimitMap.delete(existingKey);
    }

    const record = rateLimitMap.get(trackerKey);

    if (!record) {
        rateLimitMap.set(trackerKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
        return;
    }

    if (record.count >= MAX_REQUESTS_PER_WINDOW) {
        throw new RateLimitedError(
            'Rate limit exceeded. Please wait before generating more AI content.',
        );
    }

    record.count++;
}

/**
 * The last line of the "all calls server-side only" rule.
 *
 * `import 'server-only'` already fails the BUILD if any of this reaches a
 * client bundle. This fails at RUNTIME, which covers the case that guard
 * cannot: a test environment or a bundler config where the package resolves to
 * something harmless.
 */
export function assertServerSide(): void {
    if (typeof window !== 'undefined') {
        throw new Error('Security violation: AI guardrails enforce server-side execution only.');
    }
}
