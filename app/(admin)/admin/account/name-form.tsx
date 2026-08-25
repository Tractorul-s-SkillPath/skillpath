/**
 * The admin's own name, and the editor for it.
 *
 * A trimmed cousin of <ProfileHeader>, not a reuse of it: that component is
 * mostly XP bar, streak flame and skill-level chip, none of which an admin has.
 * Sharing it would have meant three role props threaded through it to hide two
 * thirds of what it renders.
 *
 * What IS shared is the thing worth sharing — profileService.updateName, one
 * layer down. The duplication here is layout, which is cheap; the logic is not
 * duplicated at all.
 */

'use client';

import * as React from 'react';
import { useActionState, useState } from 'react';
import { Pencil } from 'lucide-react';
import { updateAdminNameAction } from './actions';
import { IDLE } from '../../../../lib/validation/common';
import { Avatar } from '../../../../components/ui/avatar';
import { Button } from '../../../../components/ui/button';
import { Chip } from '../../../../components/ui/chip';
import { Field, Input } from '../../../../components/ui/field';
import { SubmitButton } from '../../../../components/submit-button';
import { FormStatus } from '../../../../components/form-status';
import { fullName, initialsOf } from '../../../../lib/utils';
import type { UserPublicRow } from '../../../../lib/supabase/database.types';

export function NameForm({ user }: { user: UserPublicRow }) {
    const [editing, setEditing] = useState(false);
    const [state, formAction] = useActionState(updateAdminNameAction, IDLE);

    const name = fullName(user.first_name, user.last_name);

    // Close the editor once the save round-trips successfully.
    React.useEffect(() => {
        if (state.status === 'success') setEditing(false);
    }, [state.status]);

    return (
        <header className="rise rounded-[var(--radius-card)] border border-border bg-surface px-5 py-6 sm:px-6">
            <div className="flex min-w-0 gap-4">
                <Avatar
                    initials={initialsOf(user.first_name, user.last_name, user.email)}
                    seed={String(user.user_id)}
                    size={64}
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
                                    defaultValue={user.first_name}
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
                                    defaultValue={user.last_name}
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

                        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>

                        <div className="mt-3">
                            <Chip tone="accent">Administrator</Chip>
                        </div>

                        {/* Success and error both land here once the editor has
                            closed — otherwise a save would be silent. */}
                        <FormStatus state={state} className="mt-3" />
                    </div>
                )}
            </div>
        </header>
    );
}

export default NameForm;
