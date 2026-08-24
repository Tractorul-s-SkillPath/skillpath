/**
 * Pagination control.
 *
 * Stories: SP-030, SP-033, SP-082, SP-086
 *
 * Page state lives in the URL, so it survives a refresh and can be pasted to
 * somebody else. `buildHref` is passed in rather than assembled here because
 * every list carries different filters alongside `page`, and dropping them on
 * "Next" is the classic version of this bug.
 *
 * This renders from a total the query already returned. It never loads
 * everything and slices — if a caller has the whole list in memory to count it,
 * the paging happened in the wrong place.
 *
 * Links, not buttons: each page is a real address, so middle-click and "open in
 * new tab" work, and the control needs no JavaScript. The unavailable ends are
 * `<span>`s rather than disabled links, because a disabled link is not a thing
 * HTML has.
 *
 * Test: tests/components/pagination.test.tsx
 */

import Link from 'next/link';
import { buttonClass } from './ui/button';

interface PaginationProps {
    page: number;
    totalPages: number;
    /** Given a page number, the URL for it — filters and all. */
    buildHref: (page: number) => string;
    /** What is being paged, for the screen-reader label: "results", "users". */
    label?: string;
    className?: string;
}

export function Pagination({ page, totalPages, buildHref, label = 'results', className }: PaginationProps) {
    // One page is not a pagination control, it is noise.
    if (totalPages <= 1) return null;

    const previous = page > 1;
    const next = page < totalPages;

    return (
        <nav
            aria-label={`${label} pages`}
            className={`flex items-center justify-between gap-4 ${className ?? ''}`}
        >
            <p className="text-[0.8125rem] text-muted-foreground">
                Page <span className="font-medium text-foreground tabular">{page}</span> of{' '}
                <span className="font-medium text-foreground tabular">{totalPages}</span>
            </p>

            <div className="flex gap-2">
                {previous ? (
                    <Link href={buildHref(page - 1)} rel="prev" className={buttonClass('secondary', 'sm')}>
                        ← Previous
                    </Link>
                ) : (
                    <span aria-hidden="true" className={buttonClass('secondary', 'sm', 'opacity-45')}>
                        ← Previous
                    </span>
                )}

                {next ? (
                    <Link href={buildHref(page + 1)} rel="next" className={buttonClass('secondary', 'sm')}>
                        Next →
                    </Link>
                ) : (
                    <span aria-hidden="true" className={buttonClass('secondary', 'sm', 'opacity-45')}>
                        Next →
                    </span>
                )}
            </div>
        </nav>
    );
}

export default Pagination;
