/**
 * Read the current session.
 *
 * Stories: SP-010, SP-012
 *
 * Sketch: getCurrentUser() -> { userId, role, status } | null, from
 * supabase.auth.getUser() (verified server-side) joined to profiles. Never from
 * getSession(), which trusts the cookie payload.
 *
 * Test: tests/lib/auth/current-user.test.ts
 */

import { createClient } from '../supabase/server';
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {User} from "@supabase/auth-js";
export type UserRole = 'student' | 'admin';

export async function registerAction(formData: FormData): Promise<void> {
    'use server';

    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = (formData.get('role') as string) || 'student';

    const supabase = await createClient();

    // 1. Inserăm în baza de date
    const { error } = await supabase
        .from('users')
        .insert([
            {
                first_name: firstName,
                last_name: lastName,
                email: email,
                password: password,
                role: role,
                status: 'active'
            }
        ]);

    if (error) {
        console.error("Eroare Supabase:", error);
        throw new Error("Nu s-a putut salva utilizatorul în baza de date.");
    }

    // 2. În loc de sesiune automată, redirecționăm către pagina de succes
    redirect('/register/success');
}

export async function getCurrentUser(): Promise<User | null>
{
    const cookieStore = await cookies();
    const session = cookieStore.get('auth_session')?.value;
    if (!session) return null;

    try {
        return JSON.parse(session) as User;
    } catch {
        return null;
    }
}

export async function loginAction(formData: FormData): Promise<void> {
    'use server';

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const supabase = await createClient();

    const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', password) // Verificăm parola din tabel
        .single();

    if (error || !userData) {
        throw new Error("Email sau parolă incorectă.");
    }

    const cookieStore = await cookies();
    cookieStore.set('auth_session', JSON.stringify({
        userId: userData.user_id,
        firstName: userData.first_name,
        lastName: userData.last_name,
        email: userData.email,
        role: userData.role,
        status: userData.status
    }), { path: '/' });

    if (userData.role === 'admin') {
        redirect('/admin');
    } else {
        redirect('/dashboard');
    }
}

export async function logoutAction(): Promise<void>
{
    'use server';

    const cookieStore = await cookies();
    // Ștergem cookie-ul de sesiune
    cookieStore.delete('auth_session');

    // Redirecționăm utilizatorul înapoi la pagina de login sau home
    redirect('/login');
}