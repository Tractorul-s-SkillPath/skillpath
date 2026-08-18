/**
 * Login form — client component.
 *
 * Story: SP-010
 *
 * Sketch
 *  - useActionState(login) from ./actions
 *  - client-side Zod (lib/validation/auth.schema.ts) — the SAME schema the
 *    action parses with; the client copy is UX, the server copy is the rule
 *  - one generic error for bad credentials. Never "no such user" (SP-010 AC2)
 *  - disabled submit while pending (components/submit-button.tsx)
 */
