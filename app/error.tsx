'use client';

/**
 * Global error boundary.
 *
 * Layer: PAGE (client component — error boundaries must be)
 * Story: SP-001 · convention §8: services return Result, so only *unexpected*
 * throws reach this file.
 *
 * `error.message` is never rendered. It can carry a Postgres message, a table
 * name or a constraint name, none of which belong on a stranger's screen. The
 * digest is shown instead, because it is the one thing that makes a bug report
 * actionable — it matches a line in the server logs.
 *
 * The copy here was in Romanian while every other string in the product was in
 * English, and without diacritics at that.
 */

import { useEffect } from 'react';
import { Button } from '../components/ui/button';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[error-boundary]', error.digest ?? '(no digest)', error);
    }, [error]);

    return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
            <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>

            <p className="text-sm leading-relaxed text-muted-foreground">
                An unexpected error stopped this page from loading. Nothing you did caused it, and
                nothing you had saved is lost.
            </p>

            <div className="flex gap-2">
                <Button variant="primary" onClick={reset}>
                    Try again
                </Button>
                {/*
                 * A plain <a>, not <Link>, and deliberately so: this renders
                 * only when the React tree below has already thrown. A client
                 * navigation would try to recover inside that same broken
                 * tree; a full document load is the thing that actually gets
                 * the user out. The rule cannot see that distinction.
                 */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a
                    href="/"
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
                >
                    Go home
                </a>
            </div>

            {error.digest ? (
                <p className="text-xs text-subtle-foreground">
                    Reference <code className="tabular">{error.digest}</code>
                </p>
            ) : null}
        </main>
    );
}
