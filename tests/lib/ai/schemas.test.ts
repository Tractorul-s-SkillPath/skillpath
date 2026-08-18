/**
 * Tests for lib/ai/schemas.ts. This is the untrusted-input boundary (§6.1).
 *
 * Stories: SP-091, SP-092, SP-093
 *
 * Cases
 *  - a well-formed draft question parses
 *  - two correct answers -> rejected (same invariant as the admin form and the
 *    partial unique index; the model does not get an exemption)
 *  - zero correct answers -> rejected
 *  - 1 or 7 options -> rejected
 *  - extra keys the model invented are stripped, not passed through to SQL
 *  - a 50KB ai_description is rejected by the length bound
 *  - prompt-injection-looking text in a field is DATA: it parses, it is stored,
 *    and it is never executed or interpolated into a later prompt
 */
