# lib/ai

One interface, two implementations, chosen by `AI_PROVIDER` (ARCHITECTURE §6).

`mock` is the **default in tests and CI** — a broken API key never blocks a
teammate, and a merged mocked feature beats an unmerged real one (§10).

The four rules that turn "we called an LLM" into a graded feature:

1. **Model output is untrusted input** — Zod-parse before the database.
2. **Degrade, never block** — the rule-based path renders first, always.
3. **Human in the loop** — AI questions insert inactive; an admin activates.
4. **Persist the output** — never regenerate per page view.

Only `lib/services/ai.service.ts` imports from this folder. Pages and actions
do not talk to a provider directly.
