/**
 * Stand-in for the `server-only` package, wired up by the alias in
 * vitest.config.ts.
 *
 * The real package exports a module that throws unless the importer is being
 * built for a React Server Component graph. That is exactly what we want in the
 * app and exactly what stops Vitest importing lib/services at all, so under
 * test it resolves here instead and does nothing.
 *
 * This does not weaken the guard: the real package is still what `next build`
 * resolves, so a service leaking into a client component still fails the build.
 */

export {};
