/**
 * In-memory implementations of every interface in lib/repositories/types.ts.
 *
 * ARCHITECTURE §7: this file is the reason service tests need no Supabase mock.
 *
 * Sketch
 *  - each repo backed by a Map, seeded through a plain object argument
 *  - they enforce the DATABASE's invariants too: rejecting a second correct
 *    answer, rejecting a second in-progress assessment, upserting on the unique
 *    keys. A fake that is more permissive than Postgres lets service tests pass
 *    on data the real database would refuse.
 *  - counters for "was this written?" assertions, no jest.fn ceremony
 *
 * When you add a method to types.ts, add it here in the same commit.
 */
