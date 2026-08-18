# lib/domain

**Pure functions. No I/O. No React. No supabase-js. No Date.now() — pass the
clock in.**

This is where the 75% coverage requirement is satisfied (ARCHITECTURE §3.1),
because pure functions need no mocks and no database. Target here is ~95%.

If you are mocking Supabase to test a rule in this folder, the rule is in the
wrong layer — or the I/O belongs in the service that calls it.

Every threshold in the product is a constant in `constants.ts`. Mentors will ask
where a level comes from; there must be exactly one answer.
