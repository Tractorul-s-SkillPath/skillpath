/**
 * Result<T, E> — services return failure, they do not throw it.
 *
 * ARCHITECTURE §8. An exception crossing a layer boundary loses its meaning by
 * the time it reaches a form; a Result forces the caller to say what happens
 * when the thing fails.
 *
 * Test: tests/lib/result.test.ts
 */

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
    return { ok: false, error };
}

/** For the read paths where a failure means "render the empty state". */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
    return result.ok ? result.value : fallback;
}
