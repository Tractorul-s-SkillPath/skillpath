/**
 * Prompt templates.
 *
 * Stories: SP-091, SP-092, SP-093, SP-094
 *
 * Sketch: one exported builder per capability, each taking a typed context.
 * Prompts are data, kept out of the provider so both providers share them and
 * a change is reviewable in a diff.
 *
 * SP-094: no PII beyond first name and scores goes into any prompt. Build the
 * context objects so there is nothing else available to interpolate.
 *
 * Test: tests/lib/ai/prompts.test.ts
 */
