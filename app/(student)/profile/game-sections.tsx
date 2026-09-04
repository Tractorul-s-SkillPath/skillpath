/**
 * Achievements, today's quests, weekly leaderboard.
 *
 * Stories: SP-102, SP-104, SP-105
 *
 * All three are read-only, so they stay server components — no client bundle
 * for a list of badges.
 */

import { Section } from '../../../components/ui/card';
import { Progress } from '../../../components/ui/progress';
import { EmptyState } from '../../../components/empty-state';
import { Icon } from '../../../components/icon';
import { formatDate } from '../../../lib/utils';
import type { Badge, LeaderboardEntry, MyRank, Quest } from '../../../lib/domain/types';

/**
 * Locked badges are shown, greyed, with their criteria. A grid of only what you
 * already have gives nothing to aim at, which is the entire point of a badge.
 */
export function BadgesSection({ badges }: { badges: Badge[] }) {
    const earned = badges.filter((b) => b.earned).length;

    return (
        <Section
            id="achievements"
            title="Achievements"
            description="Locked ones show what they take."
            action={
                <span className="text-xs text-muted-foreground tabular">
                    {earned} of {badges.length}
                </span>
            }
        >
            {badges.length === 0 ? (
                <EmptyState title="No badges" description="The badge catalog is empty." />
            ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {badges.map((badge) => {
                        const unlocked = badge.earned;

                        return (
                            <li
                                key={badge.badgeId}
                                className={`flex gap-3 rounded-lg border px-3.5 py-3 ${
                                    unlocked
                                        ? 'border-border bg-surface-muted'
                                        : 'border-dashed border-border-strong'
                                }`}
                            >
                                <span
                                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                                        unlocked
                                            ? 'bg-accent-soft text-[color:var(--accent-hover)]'
                                            : 'bg-surface-muted text-subtle-foreground'
                                    }`}
                                >
                                    <Icon name={unlocked ? badge.icon : 'lock'} size={15} />
                                </span>

                                <div className="min-w-0">
                                    <p
                                        className={`text-[0.8125rem] font-medium ${
                                            unlocked ? 'text-foreground' : 'text-muted-foreground'
                                        }`}
                                    >
                                        {badge.name}
                                    </p>
                                    {/* An earned badge must never show its own
                                        criteria — that reads as "not yet". Some
                                        are earned from rows that carry no date,
                                        so those say "Earned" and stop there. */}
                                    <p className="mt-0.5 text-xs leading-snug text-subtle-foreground">
                                        {unlocked
                                            ? badge.earnedAt
                                                ? `Earned ${formatDate(badge.earnedAt)}`
                                                : 'Earned'
                                            : badge.description}
                                    </p>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Section>
    );
}

/**
 * Three a day, the same three for everybody, chosen by the database from the
 * date — so they cannot be rerolled by refreshing.
 */
export function QuestsSection({ quests }: { quests: Quest[] }) {
    return (
        <Section
            id="today"
            title="Today"
            description="Derived from what you do today. Resets at midnight."
        >
            {quests.length === 0 ? (
                <EmptyState title="Nothing set for today" description="Check back tomorrow." />
            ) : (
                <ul className="space-y-3">
                    {quests.map((quest) => {
                        const done = Boolean(quest.completedAt);
                        const progress = Math.min(quest.progressCount, quest.targetCount);

                        return (
                            <li key={quest.questId} className="flex items-start gap-3">
                                <span
                                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                                        done
                                            ? 'bg-success-soft text-[color:var(--success)]'
                                            : 'bg-surface-muted text-muted-foreground'
                                    }`}
                                >
                                    <Icon name={done ? 'check' : quest.icon} size={15} />
                                </span>

                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                        <p className="text-[0.8125rem] font-medium">{quest.name}</p>
                                        <span className="text-xs text-subtle-foreground tabular">
                                            {done
                                                ? 'Complete'
                                                : `${progress} / ${quest.targetCount}`}{' '}
                                            · {quest.xpReward} XP
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        {quest.description}
                                    </p>
                                    <Progress
                                        className="mt-2"
                                        value={progress}
                                        max={quest.targetCount}
                                        label={quest.name}
                                        tone={done ? 'success' : 'accent'}
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Section>
    );
}

/**
 * The only place a member sees another member's data — and all it can show is a
 * shortened name and a number, because the function it comes from returns
 * nothing else.
 */
export function LeaderboardSection({
    entries,
    myRank,
}: {
    entries: LeaderboardEntry[];
    myRank: MyRank | null;
}) {
    const inTopTen = entries.some((entry) => entry.isYou);

    return (
        <Section
            id="leaderboard"
            title="This week"
            description="XP earned since Monday. Resets weekly."
            action={
                myRank ? (
                    <span className="text-xs text-muted-foreground tabular">
                        #{myRank.rank} of {myRank.totalMembers}
                    </span>
                ) : null
            }
        >
            {entries.length === 0 ? (
                <EmptyState
                    title="Nobody has scored yet"
                    description="Be the first — finishing anything at all puts you on the board."
                />
            ) : (
                <ol className="divide-y divide-border">
                    {entries.map((entry) => (
                        <li
                            key={`${entry.rank}-${entry.displayName}`}
                            className={`flex items-center gap-3 py-2 first:pt-0 ${
                                entry.isYou ? 'font-medium' : ''
                            }`}
                        >
                            <span className="w-7 text-right text-xs text-subtle-foreground tabular">
                                {entry.rank}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm">
                                {entry.displayName}
                                {entry.isYou ? (
                                    <span className="ml-2 text-xs text-[color:var(--accent)]">
                                        you
                                    </span>
                                ) : null}
                            </span>
                            <span className="text-sm tabular">{entry.xp}</span>
                        </li>
                    ))}

                    {/* Your own row, even when you are nowhere near the top. */}
                    {!inTopTen && myRank ? (
                        <li className="flex items-center gap-3 border-t border-border-strong py-2 font-medium">
                            <span className="w-7 text-right text-xs text-subtle-foreground tabular">
                                {myRank.rank}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm">You</span>
                            <span className="text-sm tabular">{myRank.xp}</span>
                        </li>
                    ) : null}
                </ol>
            )}
        </Section>
    );
}
