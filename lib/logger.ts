/**
 * Structured server-side logging.
 *
 * Risk table (§10): "RLS silently blocks a query and it just looks like an empty
 * list." Every repository logs its `error` object explicitly through here. The
 * banned pattern is `data ?? []` on a failed query — that is the bug this file
 * exists to make impossible to hide.
 *
 * Sketch: logger.error(scope, message, meta) / warn / info. JSON to stdout so
 * Vercel groups it. No PII beyond user id.
 */
