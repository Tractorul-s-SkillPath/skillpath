/**
 * RTL render wrapper.
 *
 * Sketch: renders with whatever providers the app needs, re-exports everything
 * from @testing-library/react, and exports a configured userEvent.
 *
 * Import from here, never from @testing-library/react directly, so adding a
 * provider later is a one-file change.
 */
