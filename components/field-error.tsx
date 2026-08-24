/**
 * Field-level validation message.
 *
 * Sketch: renders the Zod flatten() fieldErrors entry for one field, wired to
 * aria-describedby / aria-invalid on the input. Server errors and client errors
 * render through the same component, because they come from the same schema.
 */
