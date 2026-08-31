import { describe, it, expect } from 'vitest';
import { questionSchema } from '../../../lib/validation/question.schema';

describe('Question Validation', () => {
  it('acceptă o întrebare cu variante valide (cel puțin una corectă, cel puțin una greșită)', () => {
    const validQuestion = {
      text: 'Ce este React?',
      categoryId: 1,
      difficulty: 'beginner',
      answers: [
        { text: 'Un framework', isCorrect: true },
        { text: 'Un limbaj', isCorrect: false },
        { text: 'O bază de date', isCorrect: false },
        { text: 'Un OS', isCorrect: false },
      ]
    };
    expect(questionSchema.safeParse(validQuestion).success).toBe(true);
  });

  it('respinge o întrebare unde toate variantele sunt marcate drept corecte', () => {
    const invalidQuestion = {
      text: 'Întrebare fără opțiune greșită',
      categoryId: 1,
      difficulty: 'beginner',
      answers: [
        { text: 'Da', isCorrect: true },
        { text: 'Absolut', isCorrect: true }
      ]
    };
    expect(questionSchema.safeParse(invalidQuestion).success).toBe(false);
  });

  it('respinge răspunsurile duplicate, ignorând majusculele', () => {
    const duplicateAnswers = {
      text: 'Ce este React?',
      categoryId: 1,
      difficulty: 'beginner',
      answers: [
        { text: 'Un framework', isCorrect: true },
        { text: 'un framework', isCorrect: false }
      ]
    };
    expect(questionSchema.safeParse(duplicateAnswers).success).toBe(false);
  });
});