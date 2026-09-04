/**
 * Create an account.
 *
 * Stories: SP-010, SP-011
 *
 * ---------------------------------------------------------------------------
 * EVERY FAILURE USED TO REPORT ITSELF AS `email_already_exists`.
 * ---------------------------------------------------------------------------
 *
 * That one line cost an afternoon. The E2E journey registers a freshly minted
 * address every run, so "email already exists" was impossible by construction —
 * and it was what the page said, for two days, while the real error was
 *
 *     429 email rate limit exceeded
 *
 * Supabase's built-in SMTP allows a couple of confirmation mails an hour, and
 * the suite asks for more than that. A masked error does not just hide the
 * cause; it actively argues for the wrong fix, because the message that IS
 * shown is a plausible story about a different bug.
 *
 * So each condition below carries its own code, and anything unrecognised is
 * logged with its status and reported as `unavailable` rather than being dressed
 * up as something specific.
 *
 * ---------------------------------------------------------------------------
 * ROLE *IS* READ FROM THIS FORM NOW. IT USED TO BE POSTED AND DROPPED.
 * ---------------------------------------------------------------------------
 *
 * ./register-form.tsx has always had an "Account type" select and, behind it,
 * an "I received manager approval" checkbox. Neither was ever read here, and
 * `on_auth_user_created` wrote 'student' regardless — so registering as an
 * Administrator produced a student row, and loginAction (which reads
 * `users.role`, not this form) sent that member to /dashboard. The page even
 * carried a `manager_approval_required` message no code path could reach.
 *
 * Both halves are wired up now: the approval is checked below, and the role
 * travels in `options.data` for the trigger to read. That is a deliberate
 * loosening of the rule this docblock used to state, and the reasoning — plus
 * what it costs — is recorded in
 * supabase/migrations/20260904090000_signup_role_from_metadata.sql. The short
 * version: the box is ticked by the person asking for the role, so it records
 * a claim rather than verifying one, which is acceptable for a course project
 * and not for anything real.
 */
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

export async function registerAction(formData: FormData): Promise<void> {
    const email = String(formData.get('email') ?? '')
        .trim()
        .toLowerCase();
    const password = String(formData.get('password') ?? '');
    const firstName = String(formData.get('firstName') ?? '').trim();
    const lastName = String(formData.get('lastName') ?? '').trim();

    if (!email || !password) {
        redirect('/register?error=missing_fields');
    }

    // Supabase's own floor is 6. Asking for 8 here keeps the message ours and
    // in one place; letting it through and translating Supabase's wording back
    // into a code is the same check written twice.
    if (password.length < 8) {
        redirect('/register?error=password_too_short');
    }

    // Anything that is not the string the select emits is a student. A crafted
    // POST can send "owner" or an empty value, and the column is an enum — the
    // narrowing has to happen before the value reaches the trigger, not after.
    const role = formData.get('role') === 'admin' ? 'admin' : 'student';

    // Unchecked boxes are simply absent from a FormData, so presence is the
    // whole test. Checked before signUp, or a refusal would leave behind an
    // account nobody was told existed.
    if (role === 'admin' && formData.get('managerApproval') === null) {
        redirect('/register?error=manager_approval_required');
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // Read by `on_auth_user_created`, which copies them into public.users.
        // `role` rides along here rather than being written afterwards because
        // this is the only path that works in both configurations: with email
        // confirmation ON there is no session yet, so an UPDATE from this
        // action would meet a null auth.uid() and be rejected by RLS.
        options: { data: { first_name: firstName, last_name: lastName, role } },
    });

    if (error) {
        console.error('[auth] sign-up failed:', error.status, error.message);

        if (error.status === 429) {
            redirect('/register?error=rate_limited');
        }

        if (error.code === 'user_already_exists') {
            redirect('/register?error=email_already_exists');
        }

        if (error.code === 'weak_password') {
            redirect('/register?error=password_too_short');
        }

        redirect('/register?error=unavailable');
    }

    // A duplicate address does NOT come back as an error when email
    // confirmation is on: Supabase returns a user with an empty `identities`
    // array instead, so that a signup form cannot be used to enumerate who has
    // an account. The page says "check your email" either way; this branch just
    // stops us reporting success to the test suite.
    if (data.user && data.user.identities?.length === 0) {
        redirect('/register?error=email_already_exists');
    }

    // Chosen starting categories. Best-effort on purpose: the account exists at
    // this point, and failing the registration over a preference would strand a
    // member with credentials they were never told worked.
    //
    // Only possible when signUp returned a session — with email confirmation ON
    // there is no session yet, RLS would reject the insert (auth.uid() is
    // null), and the member picks their categories after confirming instead.
    const chosen = [
        ...new Set(
            formData
                .getAll('skills')
                .map((value) => Number(value))
                .filter((id) => Number.isInteger(id) && id > 0),
        ),
    ];

    if (chosen.length > 0 && data.session && data.user) {
        const { error: progressError } = await supabase.from('category_progress').insert(
            chosen.map((category_id) => ({
                user_id: data.user!.id,
                category_id,
                current_level: 'beginner' as const,
            })),
        );

        if (progressError) {
            console.error('[auth] could not save chosen categories:', progressError.message);
        }
    }

    // ---------------------------------------------------------------------
    // SIGN OUT AGAIN BEFORE LEAVING. THIS IS NOT UNDOING THE REGISTRATION.
    // ---------------------------------------------------------------------
    //
    // With email confirmation ON — how the project is meant to run — signUp
    // returns no session, and a new member arrives at /success signed out. With
    // it OFF, which is how the test project is configured so the E2E suite does
    // not exhaust the ~2/hour mail quota, signUp hands back a live session
    // instead. Two different post-registration states for the same code path,
    // decided by a dashboard toggle.
    //
    // The signed-in one breaks the flow the product actually has: /success sits
    // in the (auth) group, and app/(auth)/layout.tsx redirects anyone signed in
    // to their role's home. So the member never saw "Account created
    // successfully — you can now sign in", they were thrown to /dashboard, and
    // both E2E specs failed with
    //
    //     Expected pattern: /\/success$/
    //     Received string:  "http://localhost:3100/dashboard"
    //
    // Signing out here makes the two configurations behave identically, and
    // makes the one the tests run under match the one production uses. It also
    // keeps the sign-in step of those journeys honest: a member who is already
    // authenticated would sail through /login on the layout's redirect, and the
    // assertion that sign-in works would pass without sign-in ever happening.
    //
    // A no-op when confirmation is on — there is no session to clear.
    await supabase.auth.signOut();

    redirect('/success');
}
