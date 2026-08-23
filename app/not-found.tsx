/**
 * 404.
 *
 * Story: SP-053 — opening another student's assessment id must land here.
 *
 * The wording deliberately does not distinguish "does not exist" from "not
 * yours". Saying which one leaks whether the row is real, and a member who
 * mistyped a URL is not helped by the difference.
 */

import Link from 'next/link';
import { buttonClass } from '../components/ui/button';

export const metadata = { title: 'Not found' };

export default function NotFound() {
    return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
                404
            </p>

            <h1 className="text-lg font-semibold tracking-tight">This page isn&rsquo;t here</h1>

            <p className="text-sm leading-relaxed text-muted-foreground">
                The page you were looking for either doesn&rsquo;t exist or isn&rsquo;t yours to
                open.
            </p>

            <Link href="/" className={buttonClass('secondary', 'sm')}>
                Go home
            </Link>
        </main>
    );
}
