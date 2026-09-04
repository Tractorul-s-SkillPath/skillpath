/**
 * Safety and cost guardrails.
 *
 * Story: SP-094
 *
 * Sketch
 *  scrubContext(input)      - strips anything beyond first name + scores
 *  MAX_TOKENS_PER_REQUEST   - documented, enforced
 *  rateLimit(userId, key)   - per-user cap on the generation endpoints
 *  assertServerSide()       - defence in depth alongside admin.ts's server-only
 *
 * Two points at the demo: "we capped it, and here is the test."
 *
 * Test: tests/lib/ai/guardrails.test.ts
 */

export const MAX_TOKENS_PER_REQUEST = 400;

// Simple in-memory rate limiter per user/key for demonstration & safety
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minut
const MAX_REQUESTS_PER_WINDOW = 10;

export function scrubContext(input: { userName?: string; scores?: number[]; [key: string]: any }): { name?: string; scores?: number[] } {
    const firstName = input.userName ? input.userName.trim().split(' ')[0] : undefined;

    return {
        ...(firstName ? { name: firstName } : {}),
        ...(input.scores ? { scores: input.scores } : {}),
    };
}

export function rateLimit(userId: string, key: string = 'default'): void {
    const trackerKey = `${userId}:${key}`;
    const now = Date.now();
    const record = rateLimitMap.get(trackerKey);

    if (!record || now > record.resetTime) {
        rateLimitMap.set(trackerKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
        return;
    }

    if (record.count >= MAX_REQUESTS_PER_WINDOW) {
        throw new Error('Rate limit exceeded. Please wait before generating more AI content.');
    }

    record.count++;
}

export function assertServerSide(): void {
    if (typeof window !== 'undefined') {
        throw new Error('Security violation: AI guardrails enforce server-side execution only.');
    }
}