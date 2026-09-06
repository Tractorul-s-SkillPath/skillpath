/**
 * Tests for lib/validation/question.schema.ts.
 *
 * The refinements are what earn this file: a question whose options are all
 * correct, or which offers the same answer twice in different case, is not
 * caught by any field-level rule. Both are things an admin does by accident.
 */

import { describe, it, expect } from 'vitest';
import { questionSchema } from '../../../lib/validation/question.schema';

const validQuestion = {
    text: 'What is React?',
    categoryId: 1,
    difficulty: 'beginner',
    answers: [
        { text: 'A library', isCorrect: true },
        { text: 'A language', isCorrect: false },
        { text: 'A database', isCorrect: false },
        { text: 'An operating system', isCorrect: false },
    ],
};

describe('questionSchema', () => {
    it('accepts a question with at least one correct and one incorrect answer', () => {
        expect(questionSchema.safeParse(validQuestion).success).toBe(true);
    });

    it('rejects a question where every option is marked correct', () => {
        const parsed = questionSchema.safeParse({
            ...validQuestion,
            answers: [
                { text: 'Yes', isCorrect: true },
                { text: 'Absolutely', isCorrect: true },
            ],
        });

        expect(parsed.success).toBe(false);
    });

    it('rejects a question with no correct answer at all', () => {
        const parsed = questionSchema.safeParse({
            ...validQuestion,
            answers: [
                { text: 'A library', isCorrect: false },
                { text: 'A language', isCorrect: false },
            ],
        });

        expect(parsed.success).toBe(false);
    });

    it('rejects duplicate answers, ignoring case', () => {
        const parsed = questionSchema.safeParse({
            ...validQuestion,
            answers: [
                { text: 'A library', isCorrect: true },
                { text: 'a library', isCorrect: false },
            ],
        });

        expect(parsed.success).toBe(false);
    });

    it('rejects a difficulty outside the skill-level enum', () => {
        expect(questionSchema.safeParse({ ...validQuestion, difficulty: 'expert' }).success).toBe(
            false,
        );
    });

    describe('the topic and its advice (SP-060)', () => {
        const withPair = {
            ...validQuestion,
            topicTitle: '  Component model  ',
            studyAdvice: '  Reread how props flow down.  ',
        };

        it('accepts a question with neither, which is most of the bank', () => {
            const parsed = questionSchema.safeParse(validQuestion);

            expect(parsed.success).toBe(true);
            if (!parsed.success) return;
            expect(parsed.data.topicTitle).toBeNull();
            expect(parsed.data.studyAdvice).toBeNull();
        });

        it('trims both, because a topic is matched verbatim against a plan row', () => {
            const parsed = questionSchema.safeParse(withPair);

            expect(parsed.success).toBe(true);
            if (!parsed.success) return;
            expect(parsed.data.topicTitle).toBe('Component model');
            expect(parsed.data.studyAdvice).toBe('Reread how props flow down.');
        });

        it('reads an empty input as absent rather than as a too-short topic', () => {
            // What an untouched text input actually posts. Reporting "use at
            // least 2 characters" for a field the admin deliberately skipped
            // would be a message about nothing.
            const parsed = questionSchema.safeParse({
                ...validQuestion,
                topicTitle: '',
                studyAdvice: '   ',
            });

            expect(parsed.success).toBe(true);
            if (!parsed.success) return;
            expect(parsed.data.topicTitle).toBeNull();
        });

        it('refuses a topic with no advice — half a pair is worth nothing', () => {
            const parsed = questionSchema.safeParse({
                ...validQuestion,
                topicTitle: 'Component model',
            });

            expect(parsed.success).toBe(false);
        });

        it('refuses advice with no topic to attach it to', () => {
            const parsed = questionSchema.safeParse({
                ...validQuestion,
                studyAdvice: 'Reread how props flow down.',
            });

            expect(parsed.success).toBe(false);
        });

        it('refuses a topic the plan table would refuse, at the same length', () => {
            // recommendation_plans.topic_title is `between 2 and 200`, and this
            // value is copied into it verbatim months later.
            const parsed = questionSchema.safeParse({
                ...validQuestion,
                topicTitle: 'x'.repeat(201),
                studyAdvice: 'Reread it.',
            });

            expect(parsed.success).toBe(false);
        });
    });
});
