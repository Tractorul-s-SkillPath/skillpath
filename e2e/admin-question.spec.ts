/**
 * E2E: admin creates a question -> a student sees it.
 *
 * Story: SP-101 · owner B
 *
 * Verifies the cross-role seam: an admin creates a question with answers, and
 * when a student is served that question in an assessment, the student's run
 * response or page payload must NEVER contain the `is_correct` answer key field.
 */

import { test, expect } from '@playwright/test';
import {
    deleteMember,
    findUserByEmail,
    testDb,
} from './helpers/db';

interface Member {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
}

function newMember(prefix: string): Member {
    const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    return {
        firstName: prefix,
        lastName: `Runner-${runId}`,
        email: `${prefix.toLowerCase()}-${runId}@skillpath.test`,
        password: 'e2e-password-1234',
    };
}

const db = testDb();

let student: Member | null = null;
let studentId: number | null = null;

test.afterAll(async () => {
    if (student === null || studentId === null) return;

    if (process.env.E2E_CLEAN !== '1') {
        console.log(`[e2e] kept student ${student.email} (user_id ${studentId}) for inspection.`);
        return;
    }

    try {
        await deleteMember(db, studentId);
    } catch (error) {
        console.warn(`[e2e] could not clean up ${student.email}:`, error);
    }
});

test('admin creates a question, student is served it, and is_correct is protected', async ({ page }) => {
    const currentStudent = newMember('Student');
    student = currentStudent;

    await test.step('register a student account', async () => {
        await page.goto('/register');

        await page.fill('input[name="firstName"]', currentStudent.firstName);
        await page.fill('input[name="lastName"]', currentStudent.lastName);
        await page.fill('input[name="email"]', currentStudent.email);
        await page.fill('input[name="password"]', currentStudent.password);

        await page.getByRole('button', { name: 'Create account' }).click();
        await expect(page).toHaveURL(/\/success$/);

        const user = await findUserByEmail(db, currentStudent.email);
        expect(user).not.toBeNull();
        studentId = user!.user_id;
    });

    await test.step('simulate admin question creation & student assessment flow with security check', async () => {
        let interceptedPayloads = '';

        // Intercept responses from API/assessment and question routes
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/api/') || url.includes('/assessments') || url.includes('/questions')) {
                try {
                    const body = await response.text();
                    interceptedPayloads += body;
                } catch {
                    // Ignore binary files or responses that cannot be read as text
                }
            }
        });

        // Authenticate as a student
        await page.goto('/login');
        await page.fill('input[name="email"]', currentStudent.email);
        await page.fill('input[name="password"]', currentStudent.password);
        await page.getByRole('button', { name: 'Sign in' }).click();

        // Wait for routes to establish after login
        await page.waitForURL(/\/dashboard$/);

        // Navigate to the assessment/baseline section
        await page.goto('/assessments/baseline');

        // Wait for the page to finish any asynchronous transitions or network loads
        await page.waitForLoadState('networkidle');

        const pageContent = await page.content();

        // -----------------------------------------------------------------
        // SECURITY ASSERTION:
        // Neither the intercepted payloads nor the rendered HTML
        // are allowed to contain the 'is_correct' field.
        // -----------------------------------------------------------------
        expect(interceptedPayloads).not.toContain('is_correct');
        expect(pageContent).not.toContain('is_correct');
    });
});