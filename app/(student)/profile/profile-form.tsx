/**
 * Editable profile fields — client component.
 *
 * Stories: SP-021, SP-022
 *
 * Sketch
 *  - editable: first name, last name, areas of interest (multi-select from the
 *    ACTIVE category catalog), learning objective (max length from Zod)
 *  - email / role / status are rendered read-only. Even if someone re-adds the
 *    input, the BEFORE UPDATE trigger from 0002 wins (SP-013)
 */
