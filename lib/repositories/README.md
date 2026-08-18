# lib/repositories

**The only files in the codebase that import supabase-js.**

- snake_case rows in, camelCase domain types out. The mapping happens here and
  nowhere else (§8).
- Every query checks `error` explicitly and logs it. `data ?? []` on a failed
  query turns an RLS block into a silent empty list — that is risk #1 in §10.
- Repositories never call services. No cycles.
- Each repo implements an interface from `types.ts`, so services can be handed
  an in-memory fake in tests instead of a mock.

Tests here are **integration** tests against a seeded Supabase test project and
are excluded from the coverage gate (§7).
