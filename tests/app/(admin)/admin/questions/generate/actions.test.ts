/**
 * Tests for app/(admin)/admin/questions/generate/actions.ts.
 *
 * Stories: SP-092, SP-094
 *
 * Cases
 *  - a student caller -> forbidden, the provider is never invoked
 *  - count above the cap -> rejected before the call (SP-094)
 *  - drafts are inserted status='inactive', source='ai' (SP-092 AC2)
 *  - malformed model output -> "generation failed, try again", nothing written,
 *    no 500 (SP-092 AC4)
 *  - a provider timeout is handled the same way
 *  - accept activates; reject deletes; neither touches other questions
 */
