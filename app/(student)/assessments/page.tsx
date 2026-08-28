/**
 * Assessments — every questionnaire that is actually available, and nothing else.
 *
 * Layer: PAGE — calls the service, never a repository (§3.2)
 * Stories: SP-040, SP-042, SP-048, SP-111
 *
 * The list IS the database: the baseline in whichever of its three states this
 * member left it, and the active categories with their active-question banks
 * counted live. A category an admin fills past the minimum appears on the next
 * load; nothing here is hardcoded.
 *
 * Recommended runs — the untaken baseline, and followed categories that are
 * unassessed or weak — carry the primary button. Categories with too few
 * questions are shown disabled with the reason, not hidden — a silent absence
 * looks like a bug (SP-040).
 *
 * EVERY RUN OPENS IN A NEW TAB, AND EVERY START ASKS FIRST. The paper is timed
 * from the moment it is created, so this list stays put underneath it rather
 * than being navigated away and lost. Resuming is the one control that does
 * not ask: the run exists and its clock has been running since it was made,
 * so there is nothing left to warn about.
 */

import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { assertAuth } from '../../../lib/auth/assertAuth';
import {
    getAssessmentsOverview,
    type AssessmentOption,
} from '../../../lib/services/assessment.service';
import {
    CATEGORY_PAPER_SIZE,
    MIN_CATEGORY_QUESTIONS,
    SECONDS_PER_QUESTION,
} from '../../../lib/domain/constants';
import { levelLabel } from '../../../lib/domain/levels';
import { Section } from '../../../components/ui/card';
import { Chip } from '../../../components/ui/chip';
import { EmptyState } from '../../../components/empty-state';
import { buttonClass } from '../../../components/ui/button';
import { formatScore } from '../../../lib/utils';
import { BASELINE_START_DESCRIPTION, StartDialog } from './start-dialog';

export const metadata = { title: 'Assessments · SkillPath' };

// The list reflects the live question bank and this member's open runs.
export const dynamic = 'force-dynamic';

/** Open runs first, then recommended, then the rest; alphabetical within each. */
function byUrgency(a: AssessmentOption, b: AssessmentOption): number {
    const rank = (option: AssessmentOption) =>
        option.inProgressAssessmentId !== null ? 0 : option.recommended ? 1 : option.available ? 2 : 3;

    return rank(a) - rank(b) || a.name.localeCompare(b.name);
}

/** The paper a start would draw — never the whole bank, which may be larger. */
function paperSize(questionCount: number): { size: number; minutes: number } {
    const size = Math.min(questionCount, CATEGORY_PAPER_SIZE);

    return { size, minutes: Math.round((size * SECONDS_PER_QUESTION) / 60) };
}

function OptionRow({ option }: { option: AssessmentOption }) {
    const { size, minutes } = paperSize(option.questionCount);

    return (
        <li
            className={`rounded-lg border border-border px-4 py-3 ${
                option.available
                    ? 'interactive hover:border-border-strong hover:bg-surface-muted'
                    : 'opacity-70'
            }`}
        >
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{option.name}</p>

                        {option.inProgressAssessmentId !== null ? (
                            <Chip tone="warm">In progress</Chip>
                        ) : option.recommended ? (
                            <Chip tone="accent">Recommended</Chip>
                        ) : null}
                    </div>

                    {option.description ? (
                        <p className="mt-1 max-w-prose text-[0.8125rem] leading-relaxed text-muted-foreground">
                            {option.description}
                        </p>
                    ) : null}

                    <p className="mt-1.5 text-xs text-subtle-foreground tabular">
                        {size} questions · ~{minutes} min
                        {option.level ? ` · Your level: ${levelLabel(option.level)}` : ''}
                        {option.lastScore !== null
                            ? ` · Last score ${formatScore(option.lastScore)}`
                            : ''}
                    </p>
                </div>

                <div className="shrink-0">
                    {option.inProgressAssessmentId !== null ? (
                        // Plain <a>, like every other route into a run: the tab
                        // is the point, and next/link would prefetch it.
                        <a
                            href={`/assessments/${option.inProgressAssessmentId}`}
                            target="_blank"
                            rel="noopener"
                            className={buttonClass('primary', 'sm')}
                        >
                            Resume
                        </a>
                    ) : option.available ? (
                        <StartDialog
                            href={`/assessments/start/${option.categoryId}`}
                            name={`${option.name} assessment`}
                            triggerLabel="Start"
                            triggerVariant={option.recommended ? 'primary' : 'secondary'}
                            description={`${size} questions, about ${minutes} minutes. The clock starts the moment the tab opens and submits for you when it runs out. You can retake this category whenever you like.`}
                        />
                    ) : (
                        <span className="text-xs text-subtle-foreground">
                            Needs {MIN_CATEGORY_QUESTIONS} questions — has {option.questionCount}
                        </span>
                    )}
                </div>
            </div>
        </li>
    );
}

export default async function AssessmentsPage() {
    const user = await assertAuth();

    const result = await getAssessmentsOverview(user.userId);
    if (!result.ok) throw new Error('The assessments list could not be loaded.');

    const { baseline, options } = result.value;

    return (
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 lg:py-10">
            <header className="rise">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                    Assessments
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Everything that is ready to take, drawn live from the question bank.
                </p>
            </header>

            {/* The baseline outranks everything until it is done: it is the one
                paper that sets a starting level. Afterwards it shrinks to a
                single line pointing at its results (the attempt is spent). */}
            {baseline.state !== 'submitted' ? (
                <div className="rise stagger-1 rounded-[var(--radius-card)] border border-accent bg-accent-soft px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-sm font-semibold text-foreground">
                                    {baseline.state === 'in_progress'
                                        ? 'Finish your baseline assessment'
                                        : 'Start with your baseline assessment'}
                                </h2>
                                <Chip tone="accent">Recommended</Chip>
                            </div>
                            <p className="mt-1 max-w-xl text-[0.8125rem] leading-relaxed text-muted-foreground">
                                {baseline.state === 'in_progress'
                                    ? 'Your run is still open and the clock started when you did — pick it up where you left off.'
                                    : '20 questions of general IT knowledge, across every difficulty. It sets your starting level and builds your first learning plan.'}
                            </p>
                        </div>
                        {baseline.state === 'in_progress' ? (
                            <a
                                href="/assessments/baseline"
                                target="_blank"
                                rel="noopener"
                                className={buttonClass('primary')}
                            >
                                Resume
                            </a>
                        ) : (
                            <StartDialog
                                href="/assessments/baseline"
                                name="baseline assessment"
                                triggerLabel="Begin"
                                triggerSize="md"
                                description={BASELINE_START_DESCRIPTION}
                            />
                        )}
                    </div>
                </div>
            ) : (
                <div className="rise stagger-1 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-5 py-3">
                    <p className="text-[0.8125rem] text-muted-foreground">
                        Baseline assessment — completed. One attempt, and yours is on record.
                    </p>
                    <Link
                        href={`/assessments/${baseline.assessmentId}/results`}
                        className={buttonClass('secondary', 'sm')}
                    >
                        View results
                    </Link>
                </div>
            )}

            <Section
                title="Questionnaires"
                description="One category per run. Recommended ones close the gaps your scores show."
                className="rise stagger-2"
            >
                {options.length === 0 ? (
                    <EmptyState
                        icon={<ClipboardList size={22} strokeWidth={1.5} />}
                        title="No questionnaires yet"
                        description="No category has enough questions to draw a paper from. Check back once the question bank grows."
                    />
                ) : (
                    <ul className="space-y-3">
                        {[...options].sort(byUrgency).map((option) => (
                            <OptionRow key={option.categoryId} option={option} />
                        ))}
                    </ul>
                )}
            </Section>
        </div>
    );
}
