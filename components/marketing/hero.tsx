/**
 * Hero.
 *
 * Story: SP-012
 *
 * The one job: a visitor who has never heard of SkillPath should be able to
 * say what it does after reading two lines and glancing right. That is why the
 * mockup is an assessment mid-flight rather than an abstract illustration —
 * the product is the thing on the right.
 *
 * No claim here is aspirational. Timed multiple-choice, weak areas, a
 * prioritised plan and per-category progress all exist; nothing about teams,
 * certificates or integrations does, so none of that is mentioned.
 */

import Link from 'next/link';
import { Chip } from '../ui/chip';
import { buttonClass } from '../ui/button';
import { AssessmentMock } from './mockups';

export function Hero() {
    return (
        <section className="border-b border-border" aria-labelledby="hero-title">
            <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
                <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
                    <div>
                        <Chip tone="accent">Assess · Plan · Progress</Chip>

                        <h1
                            id="hero-title"
                            className="mt-5 text-3xl font-semibold leading-[1.12] tracking-tight text-foreground sm:text-4xl lg:text-[2.65rem]"
                        >
                            Find out what you actually know in software engineering.{' '}
                            <span className="block text-muted-foreground">
                                Then close the gaps.
                            </span>
                        </h1>

                        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                            SkillPath assesses a skill with a timed question set, shows you which
                            areas are dragging your score down, and turns those into a prioritised
                            learning plan you can work through — then re-assess and watch the level
                            move.
                        </p>

                        <div className="mt-8 flex flex-wrap items-center gap-3">
                            <Link
                                href="/register"
                                className={buttonClass(
                                    'primary',
                                    'md',
                                    'h-11 px-6 text-[0.9375rem]',
                                )}
                            >
                                Create your account
                            </Link>
                            <Link
                                href="/login"
                                className={buttonClass(
                                    'secondary',
                                    'md',
                                    'h-11 px-6 text-[0.9375rem]',
                                )}
                            >
                                Sign in
                            </Link>
                        </div>

                        {/* muted-foreground, not subtle-foreground: at 13px the subtle
                         * token measures ~3:1 against the page background, under the
                         * 4.5:1 AA minimum. Subtle is for de-emphasis inside a card that
                         * already has context, not for a line someone has to read. */}
                        <p className="mt-5 text-[0.8125rem] text-muted-foreground">
                            Free to use · Starting with React, SQL and Testing
                        </p>
                    </div>

                    <div className="space-y-3">
                        <p className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                            Live assessment preview
                        </p>
                        <AssessmentMock />
                    </div>
                </div>
            </div>
        </section>
    );
}
