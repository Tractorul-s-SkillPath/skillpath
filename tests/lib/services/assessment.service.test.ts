/**
 * Tests for lib/services/assessment.service.ts.
 *
 * Stories: SP-040, SP-041, SP-042, SP-043, SP-044, SP-045, SP-053, SP-111, SP-112, SP-113
 *
 * Two ways in, one lifecycle. The baseline is pinned to the sentinel category,
 * one attempt, a fixed paper in seed order; category runs draw a shuffled paper
 * and may be retaken. Find-or-create is the shape of both entry points, and the
 * tests below are mostly about which of the three answers each state produces —
 * resume, redirect to results, or create — because getting that wrong either
 * loses a run in progress or hands somebody a second attempt at the baseline.
 *
 * Constants are imported rather than typed out: constants.ts asks for that, and
 * a test that hardcodes 20 keeps passing after the paper size changes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as assessmentRepo from '../../../lib/repositories/assessment.repo';
import * as categoryRepo from '../../../lib/repositories/category.repo';
import * as profileRepo from '../../../lib/repositories/profile.repo';
import * as questionRepo from '../../../lib/repositories/question.repo';
import * as responseRepo from '../../../lib/repositories/response.repo';
import {
    BASELINE_QUESTION_COUNT,
    BASELINE_TIME_LIMIT_SECONDS,
    CATEGORY_PAPER_SIZE,
    GENERAL_KNOWLEDGE_CATEGORY_ID,
    MIN_CATEGORY_QUESTIONS,
    SECONDS_PER_QUESTION,
    TIMER_GRACE_SECONDS,
} from '../../../lib/domain/constants';
import { FAKE_CLIENT, aRepoFailure } from '../../helpers/in-memory-repos';
import { aCategory, aCatalogCategory, MEMBER_ID } from '../../helpers/builders';
import {
    startBaseline,
    startCategory,
    getAssessmentsOverview,
    getRun,
    saveAnswer,
} from '../../../lib/services/assessment.service';

vi.mock('../../../lib/repositories/assessment.repo');
vi.mock('../../../lib/repositories/category.repo');
vi.mock('../../../lib/repositories/profile.repo');
vi.mock('../../../lib/repositories/question.repo');
vi.mock('../../../lib/repositories/response.repo');
vi.mock('../../../lib/supabase/server', () => ({
    createClient: vi.fn(async () => FAKE_CLIENT),
}));

const CATEGORY_ID = 3;
const RUN_ID = 500;
const NOW = new Date('2026-06-01T10:10:00.000Z');
const STARTED_AT = '2026-06-01T10:00:00.000Z';

/** Enough ids to fill any paper the service might ask for. */
const fullBank = Array.from({ length: 40 }, (_, index) => index + 1);

function aRow(overrides: Record<string, unknown> = {}) {
    return {
        assessment_id: RUN_ID,
        category_id: CATEGORY_ID,
        status: 'in_progress',
        total_score: null,
        submitted_at: null,
        started_at: STARTED_AT,
        created_at: STARTED_AT,
        time_limit_seconds: 600,
        ...overrides,
    } as never;
}

function anInterest(overrides: Record<string, unknown> = {}) {
    return {
        categoryId: CATEGORY_ID,
        name: 'Databases',
        level: 'intermediate',
        lastScore: 72,
        assessedAt: STARTED_AT,
        ...overrides,
    } as never;
}

/**
 * Answers findByStatus by the status it is asked for, never by call order.
 *
 * startBaseline calls it twice — once for 'submitted', once for 'in_progress'.
 * A mockResolvedValueOnce chain would encode that ordering as though it were
 * the behaviour under test: swapping the two lookups changes nothing a caller
 * can observe, and must not turn these tests red.
 */
function attemptsBy(answer: (status: string) => unknown) {
    vi.mocked(assessmentRepo.findByStatus).mockImplementation((async (
        _client: unknown,
        _userId: string,
        _categoryId: number,
        status: string,
    ) => answer(status)) as never);
}

/** The common case: this member has never sat anything. */
const noAttempts = () => attemptsBy(() => ({ ok: true, value: null }));

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    noAttempts();
    vi.mocked(assessmentRepo.listInProgress).mockResolvedValue({ ok: true, value: new Map() });
    vi.mocked(assessmentRepo.createWithResponses).mockResolvedValue({ ok: true, value: RUN_ID });
    vi.mocked(categoryRepo.findStartable).mockResolvedValue({ ok: true, value: aCategory() });
    vi.mocked(categoryRepo.findById).mockResolvedValue({ ok: true, value: aCategory() });
    vi.mocked(categoryRepo.listStartable).mockResolvedValue({ ok: true, value: [] });
    vi.mocked(profileRepo.listInterests).mockResolvedValue({ ok: true, value: [] });
    vi.mocked(questionRepo.listActiveIds).mockResolvedValue({ ok: true, value: fullBank });
    vi.mocked(responseRepo.listForRun).mockResolvedValue({ ok: true, value: [] });
    vi.mocked(responseRepo.saveSelection).mockResolvedValue({ ok: true, value: undefined });
});

afterEach(() => {
    vi.useRealTimers();
});

describe('startBaseline', () => {
    it('sends a member who already sat it to their results, not into a second attempt', async () => {
        attemptsBy((status) => ({
            ok: true,
            value: status === 'submitted' ? aRow({ status: 'submitted' }) : null,
        }));

        await expect(startBaseline(MEMBER_ID)).resolves.toEqual({
            ok: true,
            value: { kind: 'results', assessmentId: RUN_ID },
        });
        expect(assessmentRepo.createWithResponses).not.toHaveBeenCalled();
    });

    it('resumes an open attempt instead of starting again', async () => {
        attemptsBy((status) => ({
            ok: true,
            value: status === 'in_progress' ? aRow({ status: 'in_progress' }) : null,
        }));

        await expect(startBaseline(MEMBER_ID)).resolves.toEqual({
            ok: true,
            value: { kind: 'run', assessmentId: RUN_ID },
        });
        expect(assessmentRepo.createWithResponses).not.toHaveBeenCalled();
    });

    it('creates the fixed paper when there is no attempt yet', async () => {
        const result = await startBaseline(MEMBER_ID);

        expect(result).toEqual({ ok: true, value: { kind: 'run', assessmentId: RUN_ID } });
        expect(assessmentRepo.createWithResponses).toHaveBeenCalledWith(FAKE_CLIENT, {
            userId: MEMBER_ID,
            categoryId: GENERAL_KNOWLEDGE_CATEGORY_ID,
            requestedLevel: 'beginner',
            timeLimitSeconds: BASELINE_TIME_LIMIT_SECONDS,
            questionIds: fullBank.slice(0, BASELINE_QUESTION_COUNT),
        });
    });

    it('keeps the seed order — the paper ramps up, it is not shuffled', async () => {
        // Everyone sits the same paper by team decision, and the seed inserts
        // beginner through advanced. Drawing here would break both.
        await startBaseline(MEMBER_ID);

        const questionIds = vi.mocked(assessmentRepo.createWithResponses).mock.calls[0][1].questionIds;

        expect(questionIds).toEqual([...questionIds].sort((a, b) => a - b));
    });

    it('refuses rather than placing someone on a short paper (SP-111 AC3)', async () => {
        vi.mocked(questionRepo.listActiveIds).mockResolvedValue({
            ok: true,
            value: fullBank.slice(0, BASELINE_QUESTION_COUNT - 1),
        });

        const result = await startBaseline(MEMBER_ID);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('unavailable');
        expect(assessmentRepo.createWithResponses).not.toHaveBeenCalled();
    });

    it.each(['submitted', 'in_progress'])(
        'propagates a failed %s lookup rather than creating a duplicate attempt',
        async (failing) => {
            // Treating a failed read as "no attempt exists" is how a member
            // ends up with two baselines.
            attemptsBy((status) =>
                status === failing ? { ok: false, error: aRepoFailure() } : { ok: true, value: null },
            );

            await expect(startBaseline(MEMBER_ID)).resolves.toMatchObject({ ok: false });
            expect(assessmentRepo.createWithResponses).not.toHaveBeenCalled();
        },
    );

    it('propagates a failed question-bank read rather than refusing as unavailable', async () => {
        // 'unavailable' tells the member the baseline is not set up yet, which
        // is a different thing from the database being unreachable.
        vi.mocked(questionRepo.listActiveIds).mockResolvedValue({ ok: false, error: aRepoFailure() });

        const result = await startBaseline(MEMBER_ID);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('unknown');
        expect(assessmentRepo.createWithResponses).not.toHaveBeenCalled();
    });

    it('propagates a failed creation', async () => {
        vi.mocked(assessmentRepo.createWithResponses).mockResolvedValue({
            ok: false,
            error: aRepoFailure(),
        });

        await expect(startBaseline(MEMBER_ID)).resolves.toMatchObject({ ok: false });
    });
});

describe('startCategory', () => {
    it('creates a run drawn from the category bank', async () => {
        const result = await startCategory(MEMBER_ID, CATEGORY_ID);

        expect(result).toEqual({ ok: true, value: RUN_ID });

        const args = vi.mocked(assessmentRepo.createWithResponses).mock.calls[0][1];
        expect(args.questionIds).toHaveLength(CATEGORY_PAPER_SIZE);
        expect(args.timeLimitSeconds).toBe(CATEGORY_PAPER_SIZE * SECONDS_PER_QUESTION);
    });

    it('re-checks that the category is startable, because an action is a public endpoint', async () => {
        vi.mocked(categoryRepo.findStartable).mockResolvedValue({ ok: true, value: null });

        const result = await startCategory(MEMBER_ID, CATEGORY_ID);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('not_found');
        expect(assessmentRepo.createWithResponses).not.toHaveBeenCalled();
    });

    it('resumes an open run rather than starting a second one', async () => {
        vi.mocked(assessmentRepo.findByStatus).mockResolvedValue({ ok: true, value: aRow() });

        await expect(startCategory(MEMBER_ID, CATEGORY_ID)).resolves.toEqual({
            ok: true,
            value: RUN_ID,
        });
        expect(assessmentRepo.createWithResponses).not.toHaveBeenCalled();
    });

    it('refuses a bank below the minimum', async () => {
        vi.mocked(questionRepo.listActiveIds).mockResolvedValue({
            ok: true,
            value: fullBank.slice(0, MIN_CATEGORY_QUESTIONS - 1),
        });

        const result = await startCategory(MEMBER_ID, CATEGORY_ID);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('unavailable');
    });

    it('draws the whole bank when it is smaller than a full paper', async () => {
        const short = fullBank.slice(0, MIN_CATEGORY_QUESTIONS);
        vi.mocked(questionRepo.listActiveIds).mockResolvedValue({ ok: true, value: short });

        await startCategory(MEMBER_ID, CATEGORY_ID);

        const args = vi.mocked(assessmentRepo.createWithResponses).mock.calls[0][1];
        expect(args.questionIds).toHaveLength(short.length);
        expect(args.timeLimitSeconds).toBe(short.length * SECONDS_PER_QUESTION);
    });

    it('pitches the run at the level the member’s last graded run recorded', async () => {
        vi.mocked(profileRepo.listInterests).mockResolvedValue({
            ok: true,
            value: [anInterest({ level: 'advanced' })],
        });

        await startCategory(MEMBER_ID, CATEGORY_ID);

        expect(vi.mocked(assessmentRepo.createWithResponses).mock.calls[0][1].requestedLevel)
            .toBe('advanced');
    });

    it('falls back to beginner for a category the member does not follow', async () => {
        vi.mocked(profileRepo.listInterests).mockResolvedValue({
            ok: true,
            value: [anInterest({ categoryId: 99, level: 'advanced' })],
        });

        await startCategory(MEMBER_ID, CATEGORY_ID);

        expect(vi.mocked(assessmentRepo.createWithResponses).mock.calls[0][1].requestedLevel)
            .toBe('beginner');
    });

    it('still starts the run when interests cannot be read', async () => {
        // The level is a label on the row, not a gate. Losing it must not cost
        // the member the assessment.
        vi.mocked(profileRepo.listInterests).mockResolvedValue({ ok: false, error: aRepoFailure() });

        await expect(startCategory(MEMBER_ID, CATEGORY_ID)).resolves.toMatchObject({ ok: true });
    });

    it('propagates a failed category lookup rather than reporting it unavailable', async () => {
        // 'not_found' would tell the member this category does not exist.
        vi.mocked(categoryRepo.findStartable).mockResolvedValue({ ok: false, error: aRepoFailure() });

        const result = await startCategory(MEMBER_ID, CATEGORY_ID);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('unknown');
        expect(assessmentRepo.createWithResponses).not.toHaveBeenCalled();
    });

    it('propagates a failed open-run lookup rather than starting a second run', async () => {
        vi.mocked(assessmentRepo.findByStatus).mockResolvedValue({ ok: false, error: aRepoFailure() });

        await expect(startCategory(MEMBER_ID, CATEGORY_ID)).resolves.toMatchObject({ ok: false });
        expect(assessmentRepo.createWithResponses).not.toHaveBeenCalled();
    });

    it('propagates a failed bank read rather than reporting too few questions', async () => {
        vi.mocked(questionRepo.listActiveIds).mockResolvedValue({ ok: false, error: aRepoFailure() });

        const result = await startCategory(MEMBER_ID, CATEGORY_ID);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('unknown');
    });
});

describe('getAssessmentsOverview', () => {
    it('reports the baseline as not started before any attempt', async () => {
        const result = await getAssessmentsOverview(MEMBER_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.baseline).toEqual({ state: 'not_started', assessmentId: null });
    });

    it('prefers a submitted baseline over an open one', async () => {
        attemptsBy((status) => ({
            ok: true,
            value:
                status === 'submitted'
                    ? aRow({ status: 'submitted' })
                    : aRow({ assessment_id: 999 }),
        }));

        const result = await getAssessmentsOverview(MEMBER_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.baseline).toEqual({ state: 'submitted', assessmentId: RUN_ID });
    });

    it('reports an open baseline so the page can offer to resume it', async () => {
        attemptsBy((status) => ({
            ok: true,
            value: status === 'in_progress' ? aRow({ assessment_id: 999 }) : null,
        }));

        const result = await getAssessmentsOverview(MEMBER_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.baseline).toEqual({ state: 'in_progress', assessmentId: 999 });
    });

    it('reports the baseline as not started when its lookups fail', async () => {
        // The category list is the page; the baseline card is one tile on it.
        // Losing that tile must not lose the whole screen.
        attemptsBy(() => ({ ok: false, error: aRepoFailure() }));

        const result = await getAssessmentsOverview(MEMBER_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.baseline).toEqual({ state: 'not_started', assessmentId: null });
    });

    it('fails when the category list fails — without it there is no page', async () => {
        vi.mocked(categoryRepo.listStartable).mockResolvedValue({ ok: false, error: aRepoFailure() });

        await expect(getAssessmentsOverview(MEMBER_ID)).resolves.toMatchObject({ ok: false });
    });

    it('marks a category with too few questions unavailable rather than hiding it', async () => {
        vi.mocked(categoryRepo.listStartable).mockResolvedValue({
            ok: true,
            value: [aCatalogCategory({ questionCount: MIN_CATEGORY_QUESTIONS - 1 })],
        });

        const result = await getAssessmentsOverview(MEMBER_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.options[0].available).toBe(false);
    });

    it('never recommends a category it cannot offer', async () => {
        vi.mocked(categoryRepo.listStartable).mockResolvedValue({
            ok: true,
            value: [aCatalogCategory({ questionCount: MIN_CATEGORY_QUESTIONS - 1 })],
        });
        vi.mocked(profileRepo.listInterests).mockResolvedValue({
            ok: true,
            value: [anInterest({ lastScore: 10 })],
        });

        const result = await getAssessmentsOverview(MEMBER_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.options[0].recommended).toBe(false);
    });

    it('recommends a followed category the member scored badly in', async () => {
        vi.mocked(categoryRepo.listStartable).mockResolvedValue({
            ok: true,
            value: [aCatalogCategory()],
        });
        vi.mocked(profileRepo.listInterests).mockResolvedValue({
            ok: true,
            value: [anInterest({ lastScore: 10 })],
        });

        const result = await getAssessmentsOverview(MEMBER_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.options[0]).toMatchObject({ recommended: true, lastScore: 10 });
    });

    it('does not recommend a category the member does not follow', async () => {
        // There is no evidence to recommend from. It is still listed.
        vi.mocked(categoryRepo.listStartable).mockResolvedValue({
            ok: true,
            value: [aCatalogCategory()],
        });

        const result = await getAssessmentsOverview(MEMBER_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.options[0]).toMatchObject({ recommended: false, level: null });
    });

    it('degrades to no recommendations when interests cannot be read', async () => {
        vi.mocked(categoryRepo.listStartable).mockResolvedValue({
            ok: true,
            value: [aCatalogCategory()],
        });
        vi.mocked(profileRepo.listInterests).mockResolvedValue({ ok: false, error: aRepoFailure() });

        const result = await getAssessmentsOverview(MEMBER_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.options[0].recommended).toBe(false);
    });

    it('surfaces an open run so the member resumes instead of restarting', async () => {
        vi.mocked(categoryRepo.listStartable).mockResolvedValue({
            ok: true,
            value: [aCatalogCategory()],
        });
        vi.mocked(assessmentRepo.listInProgress).mockResolvedValue({
            ok: true,
            value: new Map([[CATEGORY_ID, RUN_ID]]),
        });

        const result = await getAssessmentsOverview(MEMBER_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.options[0].inProgressAssessmentId).toBe(RUN_ID);
    });
});

describe('getRun', () => {
    it('refuses a run that is not this member’s', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: true, value: null });

        const result = await getRun(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('not_found');
    });

    it('returns the run with its clock and questions', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: true, value: aRow() });

        const result = await getRun(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toMatchObject({
            assessmentId: RUN_ID,
            categoryId: CATEGORY_ID,
            startedAt: STARTED_AT,
            timeLimitSeconds: 600,
        });
    });

    it('degrades the title rather than the run when the category cannot be read', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: true, value: aRow() });
        vi.mocked(categoryRepo.findById).mockResolvedValue({ ok: false, error: aRepoFailure() });

        const result = await getRun(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.categoryName).toBe('Assessment');
    });

    it('falls back to created_at for a row written before started_at existed', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({
            ok: true,
            value: aRow({ started_at: null, created_at: '2026-05-01T09:00:00.000Z' }),
        });

        const result = await getRun(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.startedAt).toBe('2026-05-01T09:00:00.000Z');
    });

    it('falls back to the baseline limit for a row with no time limit recorded', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({
            ok: true,
            value: aRow({ time_limit_seconds: null }),
        });

        const result = await getRun(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.timeLimitSeconds).toBe(BASELINE_TIME_LIMIT_SECONDS);
    });

    it('propagates a failed lookup rather than reporting the run missing', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: false, error: aRepoFailure() });

        const result = await getRun(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('unknown');
    });

    it('propagates a failed question read — a run with no questions is not a run', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: true, value: aRow() });
        vi.mocked(responseRepo.listForRun).mockResolvedValue({ ok: false, error: aRepoFailure() });

        await expect(getRun(MEMBER_ID, RUN_ID)).resolves.toMatchObject({ ok: false });
    });
});

describe('saveAnswer', () => {
    it('records a selection on an open run', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: true, value: aRow() });

        await expect(saveAnswer(MEMBER_ID, RUN_ID, 10, 20)).resolves.toMatchObject({ ok: true });
        expect(responseRepo.saveSelection).toHaveBeenCalledWith(FAKE_CLIENT, RUN_ID, 10, 20);
    });

    it('refuses a run that is not this member’s, and writes nothing', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: true, value: null });

        const result = await saveAnswer(MEMBER_ID, RUN_ID, 10, 20);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('not_found');
        expect(responseRepo.saveSelection).not.toHaveBeenCalled();
    });

    it('refuses an answer to an already submitted run', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({
            ok: true,
            value: aRow({ status: 'submitted' }),
        });

        const result = await saveAnswer(MEMBER_ID, RUN_ID, 10, 20);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('conflict');
        expect(responseRepo.saveSelection).not.toHaveBeenCalled();
    });

    it('refuses an answer once the server clock says time is up (SP-045 AC2)', async () => {
        // Measured from started_at on the server, so a frozen client timer
        // gains nothing.
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({
            ok: true,
            value: aRow({ time_limit_seconds: 60 }),
        });

        const result = await saveAnswer(MEMBER_ID, RUN_ID, 10, 20);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('conflict');
        expect(responseRepo.saveSelection).not.toHaveBeenCalled();
    });

    it('propagates a failed lookup rather than reporting the run missing', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: false, error: aRepoFailure() });

        const result = await saveAnswer(MEMBER_ID, RUN_ID, 10, 20);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('unknown');
        expect(responseRepo.saveSelection).not.toHaveBeenCalled();
    });

    it('measures the clock from created_at when started_at was never written', async () => {
        // The fallback decides whether time is up, so it gates a write here in
        // a way it does not in getRun. An hour-old row is well past any limit.
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({
            ok: true,
            value: aRow({ started_at: null, created_at: '2026-06-01T09:00:00.000Z' }),
        });

        const result = await saveAnswer(MEMBER_ID, RUN_ID, 10, 20);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('conflict');
        expect(responseRepo.saveSelection).not.toHaveBeenCalled();
    });

    it('falls back to the baseline limit when no time limit was recorded', async () => {
        // Ten minutes in, against the baseline's twenty-five: still open.
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({
            ok: true,
            value: aRow({ time_limit_seconds: null }),
        });

        await expect(saveAnswer(MEMBER_ID, RUN_ID, 10, 20)).resolves.toMatchObject({ ok: true });
    });

    it('accepts an answer inside the grace window', async () => {
        // 10 minutes have passed; the limit lands exactly on now, so only the
        // grace makes this one count. That is the latency it exists for.
        const elapsedSeconds = 10 * 60;
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({
            ok: true,
            value: aRow({ time_limit_seconds: elapsedSeconds - Math.floor(TIMER_GRACE_SECONDS / 2) }),
        });

        await expect(saveAnswer(MEMBER_ID, RUN_ID, 10, 20)).resolves.toMatchObject({ ok: true });
    });
});
