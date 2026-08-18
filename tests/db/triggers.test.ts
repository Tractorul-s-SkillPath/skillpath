/**
 * Migration 0001/0002 triggers.
 *
 * Stories: SP-011, SP-013
 *
 * Cases
 *  - creating an auth user creates exactly one profiles row, role='student',
 *    status='active' (SP-011 AC1)
 *  - first_name/last_name from raw_user_meta_data land in the profile (SP-011 AC3)
 *  - missing metadata -> empty strings, not null, not a failed signup
 *  - a student PATCHing their own row with role='admin' -> the update succeeds
 *    but role is STILL 'student' (SP-013 AC1) — silently kept, as designed
 *  - the same for status='active' on a deactivated account
 *  - an admin CAN change another user's role and status
 */
