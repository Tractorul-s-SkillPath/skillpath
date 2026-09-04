/**
 * Profile header — name, level, XP, streak.
 *
 * Stories: SP-021, SP-101, SP-103
 *
 * No photo: there is no column for one and no bucket to put it in, so the
 * avatar is initials on a tint derived from the member id. That is not a
 * placeholder waiting for an upload feature — it is the finished state.
 */

'use client';

import * as React from 'react';
import { useActionState, useState } from 'react';
import { Flame, Pencil } from 'lucide-react';
import { updateNameAction } from './actions';
import { IDLE } from '../../../lib/validation/common';
import { Avatar } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import { Chip } from '../../../components/ui/chip';
import { Field, Input } from '../../../components/ui/field';
import { Progress } from '../../../components/ui/progress';
import { SubmitButton } from '../../../components/submit-button';
import { FormStatus } from '../../../components/form-status';
import { levelLabel } from '../../../lib/domain/levels';
import { standingFromXp } from '../../../lib/domain/gamification';
import { fullName, initialsOf } from '../../../lib/utils';
import type { SkillLevel, StudentProfile } from '../../../lib/domain/types';

interface ProfileHeaderProps {
    profile: StudentProfile;
    xp: number;
    streak: number;
    overallLevel: SkillLevel | null;
}

export function ProfileHeader({ profile, xp, streak, overallLevel }: ProfileHeaderProps) {
    const [editing, setEditing] = useState(false);
    const [state, formAction] = useActionState(updateNameAction, IDLE);

    const standing = standingFromXp(xp);
    const name = fullName(profile.firstName, profile.lastName);

    // Close the editor once the save round-trips successfully.
    React.useEffect(() => {
        if (state.status === 'success') setEditing(false);
    }, [state.status]);

    return (
        <header className="rounded-[var(--radius-card)] border border-border bg-surface">
            <div className="flex flex-col gap-6 px-5 py-6 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-4">
                    <Avatar
                        initials={initialsOf(profile.firstName, profile.lastName, profile.email)}
                        seed={String(profile.userId)}
                        size={72}
                    />

                    {editing ? (
                        <form action={formAction} className="max-w-md flex-1 space-y-3" noValidate>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Field
                                    label="First name"
                                    htmlFor="firstName"
                                    error={state.fields?.firstName}
                                >
                                    <Input
                                        id="firstName"
                                        name="firstName"
                                        defaultValue={profile.firstName}
                                        required
                                        autoFocus
                                    />
                                </Field>
                                <Field
                                    label="Last name"
                                    htmlFor="lastName"
                                    error={state.fields?.lastName}
                                >
                                    <Input
                                        id="lastName"
                                        name="lastName"
                                        defaultValue={profile.lastName}
                                    />
                                </Field>
                            </div>
                            <div className="flex gap-2">
                                <SubmitButton size="sm" variant="primary" pendingLabel="Saving…">
                                    Save
                                </SubmitButton>
                                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                                    Cancel
                                </Button>
                            </div>
                            <FormStatus state={state} />
                        </form>
                    ) : (
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditing(true)}
                                    aria-label="Edit your name"
                                >
                                    <Pencil size={14} strokeWidth={1.75} />
                                    Edit
                                </Button>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{profile.email}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Chip tone={overallLevel ? 'accent' : 'muted'}>
                                    {levelLabel(overallLevel)}
                                </Chip>
                                <span className="text-xs text-subtle-foreground">
                                    {overallLevel
                                        ? 'highest level across your interests'
                                        : 'add an interest to set a level'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Progress block. Fixed width on desktop so the bar does not
                    stretch across the page and stop reading as a meter. */}
                <div className="w-full shrink-0 space-y-4 lg:w-72">
                    <div>
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-medium">Level {standing.level}</span>
                            <span className="text-xs text-muted-foreground tabular">
                                {standing.into} / {standing.span} XP
                            </span>
                        </div>
                        <Progress
                            className="mt-2"
                            value={standing.into}
                            max={standing.span}
                            label={`Level ${standing.level} progress`}
                        />
                        <p className="mt-1.5 text-xs text-subtle-foreground tabular">
                            {standing.remaining} XP to level {standing.level + 1} ·{' '}
                            {standing.totalXp} total
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-muted px-3 py-2.5">
                        <Flame
                            size={18}
                            strokeWidth={1.75}
                            className={
                                streak > 0 ? 'text-[color:var(--streak)]' : 'text-subtle-foreground'
                            }
                            aria-hidden="true"
                        />
                        <div className="min-w-0">
                            <p className="text-sm font-medium">
                                {streak === 0
                                    ? 'No streak yet'
                                    : `${streak} day${streak === 1 ? '' : 's'} in a row`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Counted from days you took an assessment.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
