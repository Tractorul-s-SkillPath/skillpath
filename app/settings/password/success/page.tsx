import Link from 'next/link';
import { getCurrentUser } from '../../../../lib/auth/current-user';
import { buttonClass } from '../../../../components/ui/button';

export const metadata = { title: 'Password updated successfully' };

export default async function PasswordSuccessPage() {
    const user = await getCurrentUser();

    const dashboardLink = user?.role === 'admin' ? '/admin' : '/dashboard';

    return (
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
            <div className="rounded-full bg-green-500/10 p-4 text-green-600 mb-4 border border-green-500/20">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-10 w-10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            </div>

            <h1 className="text-xl font-semibold tracking-tight">Password reset successfully!</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Your password has been changed securely. You can now continue using your account.
            </p>

            <div className="mt-6 w-full">
                <Link href={dashboardLink} className={buttonClass('primary') + ' w-full justify-center'}>
                    OK
                </Link>
            </div>
        </div>
    );
}