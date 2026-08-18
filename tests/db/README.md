# tests/db

What the **database** guarantees, asserted against a real Supabase test project
with real user tokens.

These are the tests that make ARCHITECTURE §5 true rather than aspirational.
Two clients do all the work (`tests/helpers/supabase-test-client.ts`): a student
token and an admin token. Arranging state uses the service role; every assertion
uses a user token, because a service-role assertion proves nothing about RLS.

Run separately from `npm test` — they need a database, so they have their own
script and their own CI job. Never point them at the demo project.

Definition of Done: *"RLS policy exists for any new table access path, and is
exercised by a test."* This folder is where that is satisfied.
