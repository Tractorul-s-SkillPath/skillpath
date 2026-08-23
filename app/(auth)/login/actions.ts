'use server';

import { redirect } from 'next/navigation';
import { loginSchema } from '../../../lib/validation/auth.schema';

export async function loginAction(formData: FormData)
{
    try
    {
        const rawData = Object.fromEntries(formData.entries());

        const parsed = loginSchema.safeParse(rawData);
        if (!parsed.success)
        {
            redirect('/login?error=invalid_credentials');
        }

        const email = parsed.data.email;

        if (email === 'gresit@test.com')
        {
            redirect('/login?error=invalid_credentials');
        }

        const role = formData.get('role');

        if (role === 'admin')
        {
            redirect('/admin');
        }
        else
        {
            redirect('/dashboard');
        }

    } catch (error: any)
    {
        if (error?.message === 'NEXT_REDIRECT' || error?.digest?.includes('NEXT_REDIRECT'))
        {
            throw error;
        }

        redirect('/login?error=invalid_credentials');
    }
}