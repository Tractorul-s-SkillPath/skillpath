/**
 * Root loading UI (streaming fallback).
 *
 * A skeleton rather than a spinner: it reserves the shape the page is about to
 * take, so arriving content does not shove the layout around. Route-level
 * loading.tsx files override this.
 *
 * Marked aria-hidden with a single polite live region beside it — a screen
 * reader should hear "Loading", not read out a dozen empty grey boxes.
 */

export default function Loading() {
    return (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
            <span className="sr-only" role="status">
                Loading
            </span>

            <div aria-hidden="true" className="space-y-5">
                <div className="h-28 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface-muted" />
                <div className="h-48 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface-muted" />
                <div className="h-48 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface-muted" />
            </div>
        </div>
    );
}
