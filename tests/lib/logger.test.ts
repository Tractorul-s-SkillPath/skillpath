/**
 * Tests for lib/logger.ts.
 *
 * Cases
 *  - logger.error emits structured JSON with scope and message
 *  - no PII beyond user id appears in the output
 *  - logging a Supabase error object keeps code/details/hint (that is the
 *    information that turns "empty list" into "RLS blocked it" — §10 risk 1)
 */
