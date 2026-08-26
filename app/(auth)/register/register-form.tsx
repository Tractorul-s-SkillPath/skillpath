/**
 * Registration form — client component.
 *
 * Story: SP-011
 *
 * Sketch
 *  - fields: first name, last name, email, password, confirm
 *  - password strength rejected client- AND server-side (SP-011 AC3)
 *  - duplicate email renders as a FIELD error on email, never a 500 or a toast
 */

'use client';

import { useState } from 'react';
import { registerAction } from './actions';
import { Field, Input, Label } from '../../../components/ui/field';
import { SubmitButton } from '../../../components/submit-button';

interface RegisterFormProps {
    categories: Array<{ categoryId: number; name: string }>;
}

export default function RegisterForm({ categories }: RegisterFormProps) {
    const [isAdmin, setIsAdmin] = useState(false);

    return (
        <form action={registerAction} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="firstName">
                    <Input
                        id="firstName"
                        name="firstName"
                        autoComplete="given-name"
                        placeholder="Ana"
                        maxLength={60}
                        required
                    />
                </Field>

                <Field label="Last name" htmlFor="lastName">
                    <Input
                        id="lastName"
                        name="lastName"
                        autoComplete="family-name"
                        placeholder="Popescu"
                        maxLength={60}
                    />
                </Field>
            </div>

            <Field label="Email" htmlFor="email">
                <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                />
            </Field>

            <Field label="Password" htmlFor="password">
                <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                />
            </Field>

            <Field label="Account type" htmlFor="role" hint="For the demo">
                <select
                    id="role"
                    name="role"
                    defaultValue="student"
                    onChange={(e) => setIsAdmin(e.target.value === 'admin')}
                    className="h-9.5 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-foreground transition-colors hover:border-[color:var(--accent)]"
                >
                    <option value="student">Student</option>
                    <option value="admin">Administrator</option>
                </select>
            </Field>

            {categories.length > 0 ? (
                <fieldset className="space-y-2">
                    <legend className="block text-[0.8125rem] font-medium text-foreground">
                        What do you want to be assessed on?
                    </legend>
                    <p className="text-xs text-subtle-foreground">
                        Optional — pick as many as you like.
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                        {categories.map((category) => (
                            <Label
                                key={category.categoryId}
                                htmlFor={`skill-${category.categoryId}`}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1.5 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-surface-muted has-[:checked]:border-[color:var(--accent)] has-[:checked]:bg-accent-soft has-[:checked]:text-[color:var(--accent-hover)]"
                            >
                                <input
                                    id={`skill-${category.categoryId}`}
                                    type="checkbox"
                                    name="skills"
                                    value={category.categoryId}
                                    className="size-3.5 accent-[color:var(--accent)]"
                                />
                                {category.name}
                            </Label>
                        ))}
                    </div>
                </fieldset>
            ) : null}

            {/* Checkbox - manager approval for admin role */}
            {isAdmin && (
                <div className="flex items-center space-x-2 mt-4">
                    <input
                        type="checkbox"
                        id="managerApproval"
                        name="managerApproval"
                        required
                        className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    />
                    <label htmlFor="managerApproval" className="text-[0.8125rem] text-muted-foreground">
                        I received manager approval for the admin role
                    </label>
                </div>
            )}

            <SubmitButton
                variant="primary"
                pendingLabel="Creating account…"
                className="w-full justify-center"
            >
                Create account
            </SubmitButton>
        </form>
    );
}