/**
 * AI orchestration — the only caller of lib/ai.
 *
 * Layer: SERVICE
 * Stories: SP-090, SP-091, SP-092, SP-093, SP-094
 *
 * Sketch
 *  enhancePlan(userId, subject)   - SP-091: writes ai_description onto plan rows
 *    that already exist. Additive by construction — it cannot reach
 *    rule_description, and a failure leaves a correct plan behind
 *  draftPlan(userId, subject)     - SP-091: the rows THEMSELVES, from the missed
 *    questions, for a bank the rules cannot read. Returns them; writing stays
 *    grading.service's job, through the same statement a rule-built plan uses
 *  draftQuestions(adminId, spec)  - SP-092: generates, validates against the
 *    SAME schema the admin form uses, and hands back QuestionInputs. It writes
 *    nothing — question.service owns the bank and the assertAdmin in front of it
 *  feedbackFor(userId, subject)   - SP-093: persisted, so the same result always
 *    shows the same text; falls back to lib/domain/feedback.ts
 *
 * THE ODD ONE OUT IS draftQuestions, AND DELIBERATELY. enhancePlan and
 * feedbackFor degrade silently, because a member did not ask for them and has
 * nothing to do about a provider being down. An admin who pressed "Generate"
 * DID ask, and something has to appear — so that one returns a Result and the
 * screen says "generation failed, try again" (SP-092 AC4). Never a 500 either
 * way; the difference is only whether anyone is told.
 *
 * Every path here obeys §6: parse model output with Zod before the database,
 * degrade instead of blocking, keep the human in the loop, persist the output.
 * Provider failure is a logged, caught, non-fatal condition — never a 500 and
 * never an error banner on a page that is otherwise correct.
 *
 * Test: tests/lib/services/ai.service.test.ts  (mock provider, plus a provider
 * that throws and one that times out)
 */

import 'server-only';
import { createClient } from '../supabase/server';
import * as assessmentRepo from '../repositories/assessment.repo';
import * as planRepo from '../repositories/plan.repo';
import { getProvider } from '../ai/provider';
import { draftQuestionSchema, MAX_DRAFTED_TOPICS } from '../ai/schemas';
import { priorityForDifficulty } from '../domain/recommendations';
import {
    AI_TIMEOUT_MS,
    firstNameOnly,
    isAiEnabled,
    rateLimit,
    RateLimitedError,
} from '../ai/guardrails';
import { buildFallbackFeedback, weakAreasFromReview } from '../domain/feedback';
import { appError, type AppError } from '../errors';
import { err, ok, type Result } from '../result';
import { questionSchema, type QuestionInput } from '../validation/question.schema';
import type { NewPlanItem } from '../repositories/plan.repo';
import type { ReviewItem, SkillLevel } from '../domain/types';

/**
 * A freshly written plan, as the enhancement path needs to see it.
 *
 * `topics` is what the RULES produced — titles and the rule text already on the
 * rows. The AI is shown its own input, not asked to invent one, which is the
 * mechanical difference between decorating a plan and replacing it.
 */
export interface PlanSubject {
    assessmentId: number;
    score: number;
    topics: Array<{ topicTitle: string; ruleDescription: string }>;
    /**
     * First name only, and optional. Nothing else about the member is allowed.
     * Reduced by `firstNameOnly` before it reaches a prompt, because
     * `profiles.first_name` is free text somebody can type a full name into.
     */
    firstName?: string;
}

/**
 * Elaborate an existing plan (SP-091).
 *
 * RETURNS A COUNT, NOT A Result, and never throws. Same reasoning as
 * feedbackFor: there is nothing a caller could usefully decide. The plan is
 * already written and already correct by the time this runs — every row has
 * its `rule_description` — so the only outcomes are "some rows also got an
 * `ai_description`" and "none did", and neither is news a member needs. The
 * number is for the log and for tests.
 *
 * WHERE THIS IS CALLED FROM. grading.service.submit(), immediately after the
 * rule-based rows are inserted, because that is the one moment "the plan is
 * generated" is a real event (SP-091 AC1). It costs the submit action a
 * provider round trip, bounded by AI_TIMEOUT_MS. If that latency ever becomes
 * the complaint, the alternative is to move this to first render of /plan —
 * the text is persisted either way, and ARCHITECTURE §6.2 explicitly allows AI
 * text to "appear on refresh". Nothing else would have to change.
 *
 * A TITLE THE MODEL INVENTED IS DROPPED. Only topics that came from the rules
 * can be written back, matched exactly. Model output is untrusted input (§6.1),
 * and the failure it prevents is real: an invented or paraphrased title would
 * silently update no rows, or — worse, if it collided — the wrong one.
 */
export async function enhancePlan(userId: string, subject: PlanSubject): Promise<number> {
    if (subject.topics.length === 0) return 0;
    if (!isAiEnabled()) return 0;

    try {
        rateLimit(userId, 'plan');

        const enhanced = await withTimeout(
            getProvider().enhancePlan({
                firstName: firstNameOnly(subject.firstName),
                score: subject.score,
                topics: subject.topics,
            }),
            'enhancePlan',
        );

        const known = new Set(subject.topics.map((topic) => topic.topicTitle));

        // A TITLE MAY APPEAR ONCE. Unknown titles were already dropped; this is
        // the other half — a model that repeats a title, which the schema
        // permits, would otherwise produce two updates against the same row and
        // a count that claims more rows were decorated than exist. First one
        // wins, because dropping BOTH would punish the row for the model's
        // mistake and the two descriptions are equally arbitrary.
        const seen = new Set<string>();

        const writable = enhanced.items.filter((item) => {
            if (!known.has(item.topicTitle)) {
                console.warn(
                    '[ai] enhancePlan returned an unknown topic, dropped:',
                    item.topicTitle,
                );
                return false;
            }

            if (seen.has(item.topicTitle)) {
                console.warn('[ai] enhancePlan repeated a topic, dropped:', item.topicTitle);
                return false;
            }

            seen.add(item.topicTitle);
            return true;
        });

        const saved = await planRepo.setAiDescriptions(
            await createClient(),
            userId,
            subject.assessmentId,
            writable,
        );

        if (!saved.ok) {
            console.error('[ai] plan enhancement not stored:', saved.error.message);
            return 0;
        }

        return saved.value;
    } catch (error) {
        // The rule-based plan is already in the database and already renders.
        // Nothing here is worth turning a graded run into an error over.
        console.error('[ai] plan left un-enhanced:', error);
        return 0;
    }
}

/**
 * A graded paper with no rule-based plan behind it, as the drafting path needs
 * to see it.
 *
 * `missed` is the QUESTIONS, not topics — that is the whole difference from
 * PlanSubject. Nothing here identifies the member beyond a first name, and the
 * run is named by a phrase rather than an id.
 */
export interface PlanDraftSubject {
    score: number;
    /** Completes "…in your ___." — "SQL assessment". Reused in the rule text. */
    runLabel: string;
    missed: Array<{ text: string; difficulty: SkillLevel }>;
    /** First name only, and optional. Reduced by `firstNameOnly` before the prompt. */
    firstName?: string;
}

/**
 * Draft a plan out of missed questions alone.
 *
 * WHY THIS EXISTS. `enhancePlan` decorates rows the rules produced, and the
 * rules produce nothing for a question with no `topic_title` and no
 * `study_advice` — which is most of the bank, since those two columns arrived
 * after it did. So a member could finish a category run, get AI feedback on the
 * results page, and find an empty plan: the enhancer was never the broken half,
 * there was simply never a row for it to touch. This writes those rows.
 *
 * RETURNS ROWS, WRITES NOTHING. Same split as `draftQuestions`: the thing that
 * owns the table does the inserting. grading.service already inserts a plan on
 * this exact path, and handing it `NewPlanItem[]` means a drafted plan and a
 * rule-built one go into the database through one statement with one set of
 * conflict rules, rather than through a second write path that would have to
 * remember them.
 *
 * WHAT IS STILL THE RULES' DECISION, and it matters for D5:
 *
 *  - The URGENCY. The model echoes back a difficulty — a fact about the
 *    questions it was shown — and `priorityForDifficulty` turns it into the
 *    number, on the same scale every other row uses.
 *  - The SENTENCE naming the run, which is generated here, deterministically,
 *    and goes into `rule_description`. So a drafted item renders exactly like a
 *    rule-built one that has been enhanced: a plain sentence saying where this
 *    came from, then the model's paragraph. Nothing on the page has to know
 *    which kind it is looking at.
 *
 * NEVER THROWS, and returns [] for every failure — a provider that is off, slow
 * or wrong costs the member a plan they were never going to get otherwise, and
 * must not cost them the score. The caller inserts an empty list, which
 * `insertMany` short-circuits.
 */
export async function draftPlan(userId: string, subject: PlanDraftSubject): Promise<NewPlanItem[]> {
    if (subject.missed.length === 0) return [];
    if (!isAiEnabled()) return [];

    try {
        rateLimit(userId, 'plan');

        const drafted = await withTimeout(
            getProvider().draftPlan({
                firstName: firstNameOnly(subject.firstName),
                score: subject.score,
                runLabel: subject.runLabel,
                missed: subject.missed,
            }),
            'draftPlan',
        );

        // A TITLE MAY APPEAR ONCE, and for a harder reason than in enhancePlan:
        // there, a repeat was a wasted update. Here it is a failed INSERT —
        // `recommendation_plans_topic_unique (user, category, topic)` means two
        // rows for one topic take the whole plan down with them, in a path that
        // logs and swallows. The most urgent of the two wins, which is the rule
        // buildPlanRecommendations already applies to two questions on one
        // topic.
        const byTopic = new Map<string, NewPlanItem>();

        for (const item of drafted.items) {
            const priority = priorityForDifficulty(item.difficulty);
            const existing = byTopic.get(item.topicTitle);

            if (existing && existing.priority <= priority) continue;

            byTopic.set(item.topicTitle, {
                topicTitle: item.topicTitle,
                description: `This came out of the ${item.difficulty} questions you missed in your ${subject.runLabel}.`,
                aiDescription: item.description,
                priority,
            });
        }

        // Sorted the way the rules sort, then TRUNCATED rather than rejected:
        // the prompt asks for at most MAX_DRAFTED_TOPICS and the schema
        // deliberately does not enforce it, so a model that returns nine gives
        // a member eight good items instead of none.
        return [...byTopic.values()]
            .sort((a, b) => a.priority - b.priority || a.topicTitle.localeCompare(b.topicTitle))
            .slice(0, MAX_DRAFTED_TOPICS);
    } catch (error) {
        // The score is graded and paid for by now. An undrafted plan is the
        // status quo for this member, not a regression.
        console.error('[ai] plan not drafted:', error);
        return [];
    }
}

/**
 * What the admin asked the generator for (SP-092 AC1).
 *
 * The category NAME as well as its id: the id is what the rows are written
 * with, the name is the only half a model has any use for.
 */
export interface DraftQuestionSpec {
    categoryId: number;
    categoryName: string;
    difficulty: SkillLevel;
    count: number;
}

/**
 * Generate draft questions and validate them (SP-092).
 *
 * WRITES NOTHING. This returns `QuestionInput`s — the exact type the admin's
 * own create form produces — and question.service does the inserting behind
 * assertAdmin(). Two reasons: the answer key is the one slice of authorization
 * that lives in code rather than the database (§5c), so it must not grow a
 * second entrance here; and a generator that hands back the same type a human
 * types is a generator whose output cannot skip a rule a human's does not.
 *
 * TWO VALIDATION BOUNDARIES, BOTH LOAD-BEARING:
 *
 *  1. `draftQuestionSchema` — is this the SHAPE a model was asked for? A
 *     question, two to six distinct options, and a correct answer that is one
 *     of them.
 *  2. `questionSchema` — is this a question the BANK would accept? Same schema,
 *     same refinements, same messages as the create form. A model that returns
 *     five options where two say the same thing does not get an exemption a
 *     human would not get.
 *
 * BOTH ARE APPLIED PER DRAFT, not to the batch. Four good questions out of five
 * is a useful result; refusing all five over one is not.
 *
 * An empty result after all that is a failure, not a success with no rows: the
 * admin pressed a button and nothing appeared, and the screen has to say so.
 */
export async function draftQuestions(
    adminUserId: string,
    spec: DraftQuestionSpec,
): Promise<Result<QuestionInput[], AppError>> {
    if (!isAiEnabled()) {
        return err(
            appError('unavailable', 'Question generation is switched off. Add questions by hand.'),
        );
    }

    try {
        rateLimit(adminUserId, 'questions');

        const drafts = await withTimeout(
            getProvider().generateQuestions({
                categoryName: spec.categoryName,
                difficulty: spec.difficulty,
                count: spec.count,
            }),
            'generateQuestions',
        );

        const usable: QuestionInput[] = [];

        for (const raw of drafts) {
            // Boundary 1, per draft rather than per batch. `safeParse` and not
            // `parse`: the array schema would reject all ten generations over
            // one bad element, and four good questions out of five is a useful
            // result while refusing all five over one is not.
            const shaped = draftQuestionSchema.safeParse(raw);

            if (!shaped.success) {
                console.warn('[ai] malformed draft dropped:', shaped.error.issues[0]?.message);
                continue;
            }

            const draft = shaped.data;

            // Boundary 2. Same schema, same refinements, same messages as the
            // admin's own create form.
            // BOTH OR NEITHER. questionSchema refuses half a pair — a topic
            // with no advice is a plan row that can never be written — and a
            // model that gives one without the other has still produced a
            // perfectly good question. Dropping the half is the smaller loss.
            const paired = draft.topicTitle && draft.studyAdvice;

            const candidate = questionSchema.safeParse({
                categoryId: spec.categoryId,
                text: draft.question,
                difficulty: spec.difficulty,
                topicTitle: paired ? draft.topicTitle : '',
                studyAdvice: paired ? draft.studyAdvice : '',
                answers: draft.options.map((option) => ({
                    text: option,
                    isCorrect: option === draft.correctAnswer,
                })),
            });

            if (candidate.success) usable.push(candidate.data);
            else console.warn('[ai] draft question rejected:', candidate.error.issues[0]?.message);
        }

        if (usable.length === 0) {
            return err(appError('unavailable', 'Generation failed — try again.'));
        }

        return ok(usable);
    } catch (error) {
        console.error('[ai] question generation failed:', error);

        // A timeout, a refusal and a body that will not parse are one sentence,
        // because none of them is the admin's to fix and the only useful next
        // step is the same one. A RATE LIMIT IS NOT ONE OF THEM. It is the one
        // failure here with a real, correct action attached — wait — and an
        // admin told "generation failed, try again" does exactly the wrong
        // thing: retries at once, fails again, and reads it as a broken model.
        if (error instanceof RateLimitedError) {
            return err(
                appError(
                    'conflict',
                    'Too many generations in the last minute. Wait a moment and try again.',
                ),
            );
        }

        return err(appError('unavailable', 'Generation failed — try again.'));
    }
}

/**
 * A graded run, as the feedback path needs to see it.
 *
 * Everything here is already in hand by the time a results page renders, so
 * this takes it rather than reading the same three rows again. Note what is
 * absent: no email, no surname, no user row — SP-094 is a property of this
 * shape before it is a property of the prompt builder.
 */
export interface FeedbackSubject {
    assessmentId: number;
    score: number;
    /** `assessments.ai_feedback`. Non-null means this is already decided. */
    storedFeedback: string | null;
    /** The graded paper. Weak areas are derived from it, never passed in. */
    review: ReviewItem[];
    /**
     * First name only, and optional. Nothing else about the member is allowed.
     * Reduced by `firstNameOnly` before it reaches a prompt, because
     * `profiles.first_name` is free text somebody can type a full name into.
     */
    firstName?: string;
}

/**
 * Lose the race and the page moves on without the model.
 *
 * The timer is cleared either way, so a slow-but-finished call does not hold a
 * handle open for ten seconds after the answer arrived. Nothing cancels the
 * provider itself — that is the provider's own job, and the HTTP one does
 * it — this only stops the CALLER waiting.
 */
function withTimeout<T>(work: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;

    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(
            () => reject(new Error(`${label} exceeded ${AI_TIMEOUT_MS}ms`)),
            AI_TIMEOUT_MS,
        );
    });

    return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

/**
 * The feedback for one submitted run (SP-093).
 *
 * RETURNS A STRING, NOT A Result. Every other service in this folder returns
 * `Result<T, AppError>` because every other service has a failure a caller must
 * decide about. This one does not: there is always feedback, because the
 * rule-based text in lib/domain/feedback.ts is always available and is written
 * to be good enough to ship. "The provider is down" is not news a member needs,
 * and an AC of this story is that no error banner appears on a page that is
 * otherwise correct. So failure is logged and swallowed, deliberately, and the
 * caller gets text.
 *
 * The order below is the whole story:
 *
 *  1. Already generated -> return it, and call nothing. This is §6.4, and it is
 *     what makes "the same result always shows the same text" true rather than
 *     merely likely.
 *  2. AI switched off -> the rule-based text, NOT persisted. Turning the
 *     provider back on then generates properly, instead of finding the column
 *     full of fallbacks nothing will ever replace.
 *  3. Otherwise generate, store, return. A failed store still returns the text:
 *     it costs a regeneration next time, which is better than showing nothing.
 */
export async function feedbackFor(userId: string, subject: FeedbackSubject): Promise<string> {
    const stored = subject.storedFeedback?.trim();
    if (stored) return stored;

    const weakAreas = weakAreasFromReview(subject.review);

    if (!isAiEnabled()) {
        return buildFallbackFeedback({ score: subject.score }, weakAreas);
    }

    try {
        rateLimit(userId, 'feedback');

        const feedback = (
            await withTimeout(
                getProvider().feedback({
                    firstName: firstNameOnly(subject.firstName),
                    score: subject.score,
                    weakAreas,
                }),
                'feedback',
            )
        ).trim();

        if (!feedback) throw new Error('The provider returned an empty string.');

        const saved = await assessmentRepo.saveAiFeedback(
            await createClient(),
            userId,
            subject.assessmentId,
            feedback,
        );

        if (!saved.ok) {
            console.error('[ai] feedback generated but not stored:', saved.error.message);
        }

        return feedback;
    } catch (error) {
        console.error('[ai] falling back to rule-based feedback:', error);

        return buildFallbackFeedback({ score: subject.score }, weakAreas);
    }
}
