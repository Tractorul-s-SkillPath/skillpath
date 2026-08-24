/**
 * Tests for lib/validation/category.schema.ts.
 *
 * Story: SP-031
 *
 * Cases
 *  - name of 1 char rejected, 2 accepted, 60 accepted, 61 rejected —
 *    the exact bounds of the SQL check constraint
 *  - "  ab  " is trimmed before the length check
 *  - status accepts only 'active' | 'inactive'
 */
