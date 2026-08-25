/**
 * Landing / entry point.
 *
 * Layer: PAGE
 * Story: SP-012
 *
 * Sketch
 *  - anonymous -> the marketing page (components/marketing/*)
 *  - student   -> redirect /dashboard
 *  - admin     -> redirect /admin
 *
 * A signed-in member has no use for the pitch, so they never see it: this
 * redirects rather than rendering a "welcome back" variant, which is what the
 * placeholder that used to live here did.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '../lib/auth/current-user';
import { LandingHeader } from '../components/marketing/landing-header';
import { Hero } from '../components/marketing/hero';
import { HowItWorks } from '../components/marketing/how-it-works';
import { FeatureGrid } from '../components/marketing/feature-grid';
import { ProgressPreview } from '../components/marketing/progress-preview';
import { FinalCta } from '../components/marketing/final-cta';
import { LandingFooter } from '../components/marketing/landing-footer';

// getCurrentUser reads the session cookie, so this can never be static.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
    const user = await getCurrentUser();

    if (user) {
        redirect(user.role === 'admin' ? '/admin' : '/dashboard');
    }

    return (
        <div className="min-h-dvh bg-background">
            <LandingHeader />

            <main id="main">
                <Hero />
                <HowItWorks />
                <FeatureGrid />
                <ProgressPreview />
                <FinalCta />
            </main>

            <LandingFooter />
        </div>
    );
}
