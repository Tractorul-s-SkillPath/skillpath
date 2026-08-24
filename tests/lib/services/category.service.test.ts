/**
 * Tests for lib/services/category.service.ts.
 *
 * Stories: SP-030, SP-031, SP-032, SP-040
 *
 * Cases
 *  - listSelectableCategories excludes inactive categories
 *  - and excludes active ones with too few eligible questions (SP-040 AC1)
 *  - each returned category carries the student's current level as the default
 *  - createCategory with a duplicate name -> conflict on `name`, not a throw
 *  - deactivateCategory sets status and leaves existing assessments untouched
 *  - there is no hard-delete function on the service at all
 */
