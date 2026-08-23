/**
 * Environment access, in one place.
 *
 * A missing key must fail loudly at the first call with a message that says
 * what to do. The alternative — `undefined` reaching the Supabase client —
 * surfaces later as "Invalid API key" or, worse, as an empty list that looks
 * like an empty database.
 */

export function requireEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(
            `Missing ${name}. Copy skillpath/.env.example to .env.local and fill it in ` +
                '(Supabase dashboard -> Project Settings -> API Keys), then restart the dev server.',
        );
    }

    return value;
}
