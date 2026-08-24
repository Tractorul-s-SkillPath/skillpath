/**
 * RTL tests for components/field-error.tsx.
 *
 * Cases
 *  - no error -> renders nothing and the input is not aria-invalid
 *  - an error -> the message renders, is linked by aria-describedby and the
 *    input is aria-invalid
 *  - multiple messages for one field all render
 */
