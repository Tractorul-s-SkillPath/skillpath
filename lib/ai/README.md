# lib/ai

One interface, two implementations, chosen by `AI_PROVIDER` (ARCHITECTURE §6).

**No vendor is named in this folder.** The real provider speaks the
OpenAI-compatible `POST /chat/completions` shape, which every hosted API worth
naming and every local runtime also speaks, so choosing a vendor is three
environment variables — `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` — rather than a
second implementation of `AiProvider`.

`mock` is the **default in tests and CI** — a broken API key never blocks a
teammate, and a merged mocked feature beats an unmerged real one (§10).

The four rules that turn "we called an LLM" into a graded feature:

1. **Model output is untrusted input** — Zod-parse before the database.
2. **Degrade, never block** — the rule-based path renders first, always.
3. **Human in the loop** — AI questions insert inactive; an admin activates.
4. **Persist the output** — never regenerate per page view.

Only `lib/services/ai.service.ts` imports from this folder. Pages and actions
do not talk to a provider directly.

## Where each rule is actually enforced

Rules are cheap to write down and easy to lose, so this is where each one lives:

1. **Untrusted input** — `schemas.ts`, applied per item in `ai.service`. A bad
   draft or an invented plan topic costs itself, never the batch around it.
   `openai-compatible.ts` is the only door model output comes through, and it rejects
   three things before the schema ever sees them: a refusal, an empty answer,
   and a **truncated** one. That last is the subtle one — `max_tokens` covers
   the model's reasoning as well as its answer, and a cut JSON body merely
   fails to parse, but a cut _paragraph_ is still a valid string, so without
   the `finish_reason` check a half-finished sentence would be persisted as a
   member's feedback for ever (§6.4 never regenerates it).
2. **Degrade, never block** — `AI_TIMEOUT_MS` is enforced twice: the provider
   hands it to `AbortSignal.timeout`, and `ai.service` races the whole call
   against it too,
   because the `AiProvider` interface promises no timeout of its own. Token
   budgets are per task rather than one shared number, because the three
   answers are not the same size: two sentences of feedback and a twenty-topic
   plan do not fit in the same ceiling, and the plan is the one a low-scoring
   member most needs.
3. **Human in the loop** — `question.service.generateDraftQuestions` is the ONE
   call site in the codebase that passes `source: 'ai'` and `status: 'inactive'`
   together. Both are explicit; neither is a default anywhere.
4. **Persist the output** — `assessments.ai_feedback` and
   `recommendation_plans.ai_description`. Neither is regenerated on a page view.

One asymmetry worth knowing before reading `ai.service`: `enhancePlan` and
`feedbackFor` swallow failure, because a member did not ask for them and has
nothing to do about a provider being down. `draftQuestions` returns a `Result`,
because an admin pressed a button and is owed an answer.

And one exception inside that `Result`. A timeout, a refusal and a body that
will not parse are one message — "generation failed, try again" — because none
of them is the admin's to fix. A **rate limit** is not one of them: it is the
one failure here with a correct action attached, and an admin told to try again
does exactly the wrong thing. `RateLimitedError` exists so that case can say
"wait a moment" instead.

## What is tested, and where

Every file here has a test under `tests/lib/ai`, and `lib/ai/**` is in the
coverage gate. `openai-compatible.test.ts` replaces `fetch` wholesale, so it
asserts the contract _this_ code owns — what is sent, what is done with what
comes back, and that nothing leaves untyped. It deliberately does not assert
that a vendor honours our timeout; the retry policy IS ours now, so the
attempt count is asserted directly.
