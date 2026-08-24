/**
 * Registration page.
 *
 * Layer: PAGE
 * Story: SP-011
 *
 * Posts to registerAction, which is loginAction underneath: that action creates
 * the account when the email has never been seen, which is exactly what
 * registering is here. See ./actions.ts for what it does and does not check —
 * in particular, the password field below is collected and never verified.
 *
 * The category checkboxes come from `skill_categories` rather than a hardcoded
 * list, so a category an admin adds shows up here without an edit.
 *
 * Rewritten from React.createElement into JSX in the UX pass, along with the
 * rest of the auth group. The role selector lives here now rather than on the
 * login form — see the header of ../login/page.tsx for why.
 */

import Link from 'next/link';
import { registerAction } from './actions';
import { createClient } from '../../../lib/supabase/server';
import { listActiveCategories } from '../../../lib/repositories/profile.repo';
import { unwrapOr } from '../../../lib/result';
import { Field, Input, Label } from '../../../components/ui/field';
import { Button } from '../../../components/ui/button';

export const metadata = { title: 'Create an account' };

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
    const supabase = await createClient();

    // A catalog that fails to load must not take the form down with it: an
    // account with no interests ticked is fine, and the profile page can fix it.
    const categories = unwrapOr(await listActiveCategories(supabase), []);

    return (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface px-5 py-6 sm:px-6">
            <h1 className="text-base font-semibold tracking-tight">Create an account</h1>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                Takes a minute. You can change all of this later.
            </p>

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

                <Field
                    label="Account type"
                    htmlFor="role"
                    hint="For the demo"
                >
                    <select
                        id="role"
                        name="role"
                        defaultValue="student"
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

                <Button type="submit" variant="primary" className="w-full justify-center">
                    Create account
                </Button>
            </form>

            <p className="mt-5 text-center text-[0.8125rem] text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-[color:var(--accent)] hover:underline">
                    Sign in
                </Link>
            </p>
        </div>
    );
}
