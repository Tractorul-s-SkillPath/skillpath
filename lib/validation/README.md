# lib/validation

Zod schemas, **shared by the client form and the Server Action**.

One schema, two consumers: the client copy is UX (instant feedback), the server
copy is the rule. If they can drift, they will — so they are the same import.

Definition of Done: _every input validated with Zod in the Server Action._
A Server Action is a public HTTP endpoint (§5).

This folder is inside the coverage gate. Each schema gets valid / invalid /
boundary cases — the boundaries are the ones the database also enforces
(2-60 chars, 2-6 options, priority 1-5), so a drift between Zod and SQL shows up
as a failing test rather than a 500 in the demo.
