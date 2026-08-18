/**
 * Global error boundary.
 *
 * Layer: PAGE (client component — error boundaries must be)
 * Story: SP-001 · convention §8: services return Result, only *unexpected*
 * throws reach this file.
 *
 * Sketch
 *  - generic message, a reset() button, digest logged
 *  - never renders error.message to the user: it can carry database detail
 */
