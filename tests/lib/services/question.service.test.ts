/**
 * Tests for lib/services/question.service.ts.
 *
 * Stories: SP-033, SP-034, SP-035, SP-036, SP-037, SP-084
 *
 * `answers.is_correct` is the answer key and there is no RLS on it, so the
 * assertAdmin() at the top of each function is the entire access control story
 * for the question bank. The service's own docblock calls this "the slice that
 * needs the most tests", which is why the guard is asserted per function rather
 * than once.
 *
 * The other rule with teeth: created_by comes from the session, never from the
 * form (ARCHITECTURE §5).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { assertAdmin } from '../../../lib/auth/assertAdmin';
import * as questionRepo from '../../../lib/repositories/question.repo';
import { FAKE_CLIENT } from '../../helpers/in-memory-repos';
import { anAdmin, anAdminQuestion, ADMIN_ID } from '../../helpers/builders';
import {
    listQuestionsByCategory,
    createQuestion,
    setQuestionStatus,
} from '../../../lib/services/question.service';

vi.mock('../../../lib/auth/assertAdmin');
vi.mock('../../../lib/repositories/question.repo');
vi.mock('../../../lib/supabase/server', () => ({
    // The admin services query through createServiceClient — service role, because
    // RLS has no admin policy and every write here would be refused with 42501.
    // Mocked alongside createClient so a service that is moved between the two
    // fails on its assertions rather than on an undefined import.
    createClient: vi.fn(async () => FAKE_CLIENT),
    createServiceClient: vi.fn(() => FAKE_CLIENT),
}));

const REDIRECTED = new Error('NEXT_REDIRECT /dashboard');

const validInput = {
    categoryId: 3,
    text: 'What does an index cost on write?',
    difficulty: 'intermediate' as const,
    answers: [
        { text: 'Nothing', isCorrect: false },
        { text: 'Extra work per insert', isCorrect: true },
    ],
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertAdmin).mockResolvedValue(anAdmin());
});

describe('the admin guard', () => {
    it.each([
        ['listQuestionsByCategory', () => listQuestionsByCategory(3)],
        ['createQuestion', () => createQuestion(validInput)],
        ['setQuestionStatus', () => setQuestionStatus(900, 'inactive')],
    ])('stops %s before any answer key is read or written', async (_name, call) => {
        vi.mocked(assertAdmin).mockRejectedValue(REDIRECTED);

        await expect(call()).rejects.toThrow(REDIRECTED);

        expect(questionRepo.listByCategory).not.toHaveBeenCalled();
        expect(questionRepo.insertWithAnswers).not.toHaveBeenCalled();
        expect(questionRepo.setStatus).not.toHaveBeenCalled();
    });
});

describe('listQuestionsByCategory', () => {
    it('returns the bank for one category, answer keys included', async () => {
        const bank = [anAdminQuestion()];
        vi.mocked(questionRepo.listByCategory).mockResolvedValue({ ok: true, value: bank });

        await expect(listQuestionsByCategory(3)).resolves.toEqual({ ok: true, value: bank });
        expect(questionRepo.listByCategory).toHaveBeenCalledWith(FAKE_CLIENT, 3);
    });
});

describe('createQuestion', () => {
    beforeEach(() => {
        vi.mocked(questionRepo.insertWithAnswers).mockResolvedValue({ ok: true, value: 900 });
    });

    it('takes created_by from the session, never from the caller (§5)', async () => {
        await createQuestion({ ...validInput, createdBy: 999 } as never);

        expect(questionRepo.insertWithAnswers).toHaveBeenCalledWith(
            FAKE_CLIENT,
            expect.objectContaining({ createdBy: ADMIN_ID }),
        );
    });

    it('records whichever admin is signed in, not a fixed id', async () => {
        vi.mocked(assertAdmin).mockResolvedValue(anAdmin({ userId: '00000000-0000-4000-8000-000000004242' }));

        await createQuestion(validInput);

        expect(questionRepo.insertWithAnswers).toHaveBeenCalledWith(
            FAKE_CLIENT,
            expect.objectContaining({ createdBy: '00000000-0000-4000-8000-000000004242' }),
        );
    });

    it('passes the question and its answers through unchanged', async () => {
        await createQuestion(validInput);

        expect(questionRepo.insertWithAnswers).toHaveBeenCalledWith(FAKE_CLIENT, {
            categoryId: validInput.categoryId,
            text: validInput.text,
            difficulty: validInput.difficulty,
            answers: validInput.answers,
            createdBy: ADMIN_ID,
        });
    });

    it('returns the new question id', async () => {
        await expect(createQuestion(validInput)).resolves.toEqual({ ok: true, value: 900 });
    });
});

describe('setQuestionStatus', () => {
    it.each(['active', 'inactive'] as const)('sends %s straight to the repository', async (status) => {
        vi.mocked(questionRepo.setStatus).mockResolvedValue({ ok: true, value: undefined });

        await setQuestionStatus(900, status);

        expect(questionRepo.setStatus).toHaveBeenCalledWith(FAKE_CLIENT, 900, status);
    });
});
