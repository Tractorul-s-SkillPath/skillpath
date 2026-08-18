/**
 * Tests for lib/services/admin-stats.service.ts.
 *
 * Stories: SP-080, SP-081, SP-082, SP-086
 *
 * Cases
 *  - a non-admin caller -> forbidden
 *  - overview counts exclude abandoned assessments from the average
 *  - zero assessments -> average is null/"-", never NaN
 *  - the weak-category ranking calls the aggregate repo ONCE and does no
 *    counting in JS (SP-081)
 *  - listAllResults always applies a limit
 */
