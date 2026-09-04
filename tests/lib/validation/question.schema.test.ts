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
});
