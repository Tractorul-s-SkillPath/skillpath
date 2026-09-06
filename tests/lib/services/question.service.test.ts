/**
 * Tests for lib/services/question.service.ts.
 *
 * Stories: SP-033, SP-034, SP-035, SP-036, SP-037, SP-084, SP-092
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
import * as categoryRepo from '../../../lib/repositories/category.repo';
import * as aiService from '../../../lib/services/ai.service';
import { FAKE_CLIENT } from '../../helpers/in-memory-repos';
import { anAdmin, anAdminQuestion, ADMIN_ID } from '../../helpers/builders';
import {
    listQuestionsByCategory,
    createQuestion,
    setQuestionStatus,
    generateDraftQuestions,
    deleteDraftQuestion,
} from '../../../lib/services/question.service';

vi.mock('../../../lib/auth/assertAdmin');
vi.mock('../../../lib/repositories/question.repo');
vi.mock('../../../lib/repositories/category.repo');
vi.mock('../../../lib/services/ai.service');
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
    topicTitle: 'Indexes',
    studyAdvice: 'Reread how a B-tree is maintained on insert.',
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
        vi.mocked(assertAdmin).mockResolvedValue(
            anAdmin({ userId: '00000000-0000-4000-8000-000000004242' }),
        );

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
            topicTitle: validInput.topicTitle,
            studyAdvice: validInput.studyAdvice,
            answers: validInput.answers,
            createdBy: ADMIN_ID,
        });
    });

    it('returns the new question id', async () => {
        await expect(createQuestion(validInput)).resolves.toEqual({ ok: true, value: 900 });
    });
});

describe('setQuestionStatus', () => {
    it.each(['active', 'inactive'] as const)(
        'sends %s straight to the repository',
        async (status) => {
            vi.mocked(questionRepo.setStatus).mockResolvedValue({ ok: true, value: undefined });

            await setQuestionStatus(900, status);

            expect(questionRepo.setStatus).toHaveBeenCalledWith(FAKE_CLIENT, 900, status);
        },
    );
});

// -----------------------------------------------------------------------------
// SP-092 — the AI question generator
// -----------------------------------------------------------------------------

const aDraft = (text: string) => ({
    categoryId: 3,
    text,
    difficulty: 'beginner' as const,
    topicTitle: 'Indexes',
    studyAdvice: 'Reread how a B-tree is maintained on insert.',
    answers: [
        { text: 'Right', isCorrect: true },
        { text: 'Wrong', isCorrect: false },
    ],
});

const aGenerateInput = { categoryId: 3, difficulty: 'beginner' as const, count: 2 };

function generatorReturns(drafts: ReturnType<typeof aDraft>[]) {
    vi.mocked(categoryRepo.findById).mockResolvedValue({
        ok: true,
        value: { categoryId: 3, name: 'Databases', description: '' },
    });
    vi.mocked(aiService.draftQuestions).mockResolvedValue({ ok: true, value: drafts });
    vi.mocked(questionRepo.insertWithAnswers).mockResolvedValue({ ok: true, value: 1 });
}

describe('generateDraftQuestions', () => {
    beforeEach(() => {
        vi.mocked(assertAdmin).mockResolvedValue(anAdmin());
        generatorReturns([aDraft('First draft?'), aDraft('Second draft?')]);
    });

    it('refuses a non-admin before generating anything', async () => {
        vi.mocked(assertAdmin).mockRejectedValue(REDIRECTED);

        await expect(generateDraftQuestions(aGenerateInput)).rejects.toThrow(REDIRECTED);
        expect(aiService.draftQuestions).not.toHaveBeenCalled();
    });

    it('inserts every draft inactive and marked as AI', async () => {
        // THE human-in-the-loop assertion. If either field ever stops being
        // passed, a generated question becomes drawable into a real assessment
        // without anybody reading it — and nothing else in the suite would say so.
        const result = await generateDraftQuestions(aGenerateInput);

        expect(result).toEqual({ ok: true, value: { added: 2, requested: 2 } });

        for (const call of vi.mocked(questionRepo.insertWithAnswers).mock.calls) {
            expect(call[1]).toMatchObject({ source: 'ai', status: 'inactive' });
        }
    });

    it('takes created_by from the session, never from the caller', async () => {
        await generateDraftQuestions(aGenerateInput);

        expect(vi.mocked(questionRepo.insertWithAnswers).mock.calls[0][1].createdBy).toBe(ADMIN_ID);
    });

    it('sends the model the category name rather than its id', async () => {
        await generateDraftQuestions(aGenerateInput);

        expect(aiService.draftQuestions).toHaveBeenCalledWith(ADMIN_ID, {
            categoryId: 3,
            categoryName: 'Databases',
            difficulty: 'beginner',
            count: 2,
        });
    });

    it('passes a generation failure straight through to the admin (AC4)', async () => {
        vi.mocked(aiService.draftQuestions).mockResolvedValue({
            ok: false,
            error: { code: 'unavailable', message: 'Generation failed — try again.' },
        });

        const result = await generateDraftQuestions(aGenerateInput);

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error.message).toBe('Generation failed — try again.');
        expect(questionRepo.insertWithAnswers).not.toHaveBeenCalled();
    });

    it('reports the honest count when one insert fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(questionRepo.insertWithAnswers)
            .mockResolvedValueOnce({ ok: true, value: 1 })
            .mockResolvedValueOnce({ ok: false, error: { code: 'unknown', message: 'nope' } });

        // "2 drafts added" with one missing is worse than a number that does
        // not match what was asked for.
        expect(await generateDraftQuestions(aGenerateInput)).toEqual({
            ok: true,
            value: { added: 1, requested: 2 },
        });
    });

    it('reports the count the admin ASKED for, not the count that survived validation', async () => {
        // The bug this pins. `requested` used to be `drafts.value.length` —
        // the number of drafts left AFTER ai.service dropped the malformed
        // ones — so an admin who asked for ten and got six usable questions
        // saw "6 drafts added below" rather than "6 of 10". The only shortfall
        // the screen could ever show was a failed insert, and the comment on
        // generateQuestionsAction promised the opposite.
        generatorReturns([aDraft('Only one survived?')]);

        expect(await generateDraftQuestions({ ...aGenerateInput, count: 10 })).toEqual({
            ok: true,
            value: { added: 1, requested: 10 },
        });
    });

    it('fails rather than claiming success when no draft could be stored', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(questionRepo.insertWithAnswers).mockResolvedValue({
            ok: false,
            error: { code: 'unknown', message: 'nope' },
        });

        expect((await generateDraftQuestions(aGenerateInput)).ok).toBe(false);
    });

    it('stops on an unreadable category, since the prompt needs its name', async () => {
        vi.mocked(categoryRepo.findById).mockResolvedValue({
            ok: false,
            error: { code: 'not_found', message: 'Not found.' },
        });

        expect((await generateDraftQuestions(aGenerateInput)).ok).toBe(false);
        expect(aiService.draftQuestions).not.toHaveBeenCalled();
    });
});

describe('deleteDraftQuestion', () => {
    const anAiDraft = anAdminQuestion({ source: 'ai', status: 'inactive' });

    beforeEach(() => {
        vi.mocked(assertAdmin).mockResolvedValue(anAdmin());
        vi.mocked(questionRepo.findById).mockResolvedValue({ ok: true, value: anAiDraft });
        vi.mocked(questionRepo.remove).mockResolvedValue({ ok: true, value: undefined });
    });

    it('refuses a non-admin before reading anything', async () => {
        vi.mocked(assertAdmin).mockRejectedValue(REDIRECTED);

        await expect(deleteDraftQuestion(900)).rejects.toThrow(REDIRECTED);
        expect(questionRepo.remove).not.toHaveBeenCalled();
    });

    it('deletes an inactive AI draft', async () => {
        expect(await deleteDraftQuestion(900)).toEqual({ ok: true, value: undefined });
        expect(questionRepo.remove).toHaveBeenCalledWith(FAKE_CLIENT, 900);
    });

    it('refuses a hand-written question, however inactive', async () => {
        // Retiring a manual question keeps it answerable-in-history (D4).
        // Deleting it would leave student_responses.is_correct describing a row
        // that no longer exists.
        vi.mocked(questionRepo.findById).mockResolvedValue({
            ok: true,
            value: anAdminQuestion({ source: 'manual', status: 'inactive' }),
        });

        expect((await deleteDraftQuestion(900)).ok).toBe(false);
        expect(questionRepo.remove).not.toHaveBeenCalled();
    });

    it('refuses an AI question that has been activated', async () => {
        // Activating it is the human review. Once that has happened it is a
        // question like any other, and members may have answered it.
        vi.mocked(questionRepo.findById).mockResolvedValue({
            ok: true,
            value: anAdminQuestion({ source: 'ai', status: 'active' }),
        });

        expect((await deleteDraftQuestion(900)).ok).toBe(false);
        expect(questionRepo.remove).not.toHaveBeenCalled();
    });

    it('reports a question that is already gone as not_found', async () => {
        vi.mocked(questionRepo.findById).mockResolvedValue({ ok: true, value: null });

        const result = await deleteDraftQuestion(900);

        expect(result.ok === false && result.error.code).toBe('not_found');
    });
});
