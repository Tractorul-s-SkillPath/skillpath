# lib/services

Orchestration: permission checks, multi-step writes, calling domain + repositories.

Two rules that keep this layer testable:

1. **Repositories are injected**, not imported at the top of the file. That is
   the whole reason service tests need no Supabase mock — pass the in-memory
   fakes from `tests/helpers/in-memory-repos.ts` (ARCHITECTURE §7).
2. **Return `Result<T, AppError>`.** Do not throw across the layer boundary.

Services may call domain and repositories. Repositories never call services —
no cycles, ever (§3.3).
