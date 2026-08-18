/**
 * RTL tests for app/(admin)/admin/questions/answer-editor.tsx.
 *
 * Story: SP-034
 *
 * Cases
 *  - starts with 2 rows; add goes to 6 and then the add button is disabled
 *  - remove is disabled at 2 rows
 *  - marking a second answer correct UNMARKS the first (a radio, not checkboxes)
 *  - submitting with none marked shows the form-level error (SP-034 AC2)
 */
