/**
 * Sessions.
 *
 * Supabase Auth is not in play (the schema authenticates against
 * users.password), so the session is ours. It is a signed cookie: the user id
 * and an expiry, plus an HMAC over both.
 *
 * The signature is the whole point. The previous implementation wrote
 * `{"userId":"usr_123","role":"admin"}` as plain JSON, which meant anybody
 * could edit their own cookie and become an administrator. A forged payload
 * here fails verification and is treated as signed out.
 *
 * What this still is NOT: a revocable session. There is no server-side session
 * table, so signing out clears the cookie but a copied cookie stays valid until
 * it expires. Acceptable for a seven-day cookie on a course project; worth
 * knowing before it protects anything real.
 */

import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'skillpath_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

interface SessionPayload {
    userId: number;
    expiresAt: number;
}

function secret(): string {
    const value = process.env.SESSION_SECRET;

    if (!value || value.length < 32) {
        throw new Error(
            'SESSION_SECRET is missing or too short. Add at least 32 random characters to ' +
                '.env.local — `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"` ' +
                'generates one.',
        );
    }

    return value;
}

function sign(data: string): string {
    return createHmac('sha256', secret()).update(data).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
}

export async function createSession(userId: number): Promise<void> {
    const payload: SessionPayload = {
        userId,
        expiresAt: Date.now() + MAX_AGE_SECONDS * 1000,
    };

    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const cookieStore = await cookies();

    cookieStore.set(COOKIE_NAME, `${body}.${sign(body)}`, {
        httpOnly: true,                                  // JavaScript cannot read it
        sameSite: 'lax',                                 // survives a normal link, blocks CSRF posts
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: MAX_AGE_SECONDS,
    });
}

export async function destroySession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}

/** The verified user id, or null. Never throws on a malformed cookie. */
export async function readSession(): Promise<number | null> {
    const cookieStore = await cookies();
    return parse(cookieStore.get(COOKIE_NAME)?.value);
}

function parse(raw: string | undefined): number | null {
    if (!raw) return null;

    const separator = raw.lastIndexOf('.');
    if (separator <= 0) return null;

    const body = raw.slice(0, separator);
    const signature = raw.slice(separator + 1);

    if (!safeEqual(signature, sign(body))) return null;

    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;

        if (typeof payload.userId !== 'number' || !Number.isFinite(payload.userId)) return null;
        if (typeof payload.expiresAt !== 'number' || payload.expiresAt < Date.now()) return null;

        return payload.userId;
    } catch {
        return null;
    }
}
