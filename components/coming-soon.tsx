/**
 * ComingSoon — the honest placeholder for a route that is scaffolded but unwritten.
 *
 * Several pages exist as a docblock describing what they will do and nothing
 * else. A page.tsx with no default export is not an unfinished page, it is a
 * crash: Next throws "The default export is not a React Component in page",
 * and since the header links to four of these, normal navigation walked
 * straight into it.
 *
 * So each of those files gets a default export that renders this. It says what
 * is meant to live there and offers the way back, which is the difference
 * between a product with work left and a product that is broken.
 *
 * Delete the import along with the placeholder when the real page lands.
 */

import Link from 'next/link';
import { Section } from './ui/card';
import { EmptyState } from './empty-state';
import { buttonClass } from './ui/button';

interface ComingSoonProps {
    /** The page title, as it will read when the page is real. */
    title: string;
    /** One line on what this page is for. */
    description: string;
    /** What the finished page will show, as short phrases. */
    planned?: readonly string[];
    /** Where "back" goes. Defaults to the student dashboard. */
    backHref?: string;
    backLabel?: string;
}

export function ComingSoon({
    title,
    description,
    planned,
    backHref = '/dashboard',
    backLabel = 'Back to dashboard',
}: ComingSoonProps) {
    return (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
            <Section title={title} description={description}>
                <EmptyState
                    title="Not built yet"
                    description="This route is scaffolded but the page has not been written. Nothing is broken — there is just nothing here to show you."
                    action={
                        <Link href={backHref} className={buttonClass('secondary', 'sm')}>
                            {backLabel}
                        </Link>
                    }
                />

                {planned && planned.length > 0 ? (
                    <div className="mt-5">
                        <p className="text-[0.8125rem] font-medium text-foreground">
                            What will be here
                        </p>
                        <ul className="mt-2 space-y-1.5">
                            {planned.map((item) => (
                                <li
                                    key={item}
                                    className="flex gap-2 text-[0.8125rem] leading-relaxed text-muted-foreground"
                                >
                                    <span aria-hidden="true" className="text-subtle-foreground">
                                        ·
                                    </span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}
            </Section>
        </div>
    );
}
