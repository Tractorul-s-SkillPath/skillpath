/**
 * Demo seed — one command, a database that makes the demo look real.
 *
 * Story: SP-102 · owner B
 *
 * Sketch
 *  - runs with the SERVICE ROLE key, node only, never imported by the app
 *  - creates: 4 categories, ~40 questions spread across difficulties (each with
 *    2-6 answers, exactly one correct), 1 admin, 3 students, and assessment
 *    history for those students so the dashboard and trend chart have data
 *  - idempotent: safe to re-run, upsert by natural key, never duplicates
 *  - deterministic content (fixed seed) so screenshots and the demo script match
 *
 * npm run seed
 */
