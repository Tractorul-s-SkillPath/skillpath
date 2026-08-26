'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createQuestion, setQuestionStatus } from '../../../../../lib/services/question.service';

const questionSchema = z.object({
  categoryId: z.number(),
  text: z.string().min(5, "Question text must be at least 5 characters"),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  answers: z.array(z.object({
    text: z.string().min(1, "Answer text cannot be empty"),
    is_correct: z.boolean()
  }))
  .min(2, "At least 2 options are required")
  .max(4, "Maximum 4 options allowed")
  .refine(opts => opts.some(opt => opt.is_correct), {
    message: "You must select at least one correct answer."
  }),
});

export async function createQuestionAction(categoryId: number, prevState: any, formData: FormData) {
  try {
    const rawAnswers = [];

    for (let i = 0; i < 4; i++) {
      const text = formData.get(`option_text_${i}`);
      const isCorrect = formData.get(`option_correct_${i}`) === 'true';

      if (text) {
        rawAnswers.push({ text: text as string, is_correct: isCorrect });
      }
    }

    const rawData = {
      categoryId: categoryId,
      text: formData.get('text') as string,
      difficulty: formData.get('difficulty') as string,
      answers: rawAnswers
    };

    const validatedData = questionSchema.parse(rawData);

    await createQuestion(validatedData as any);

    revalidatePath(`/admin/categories/${categoryId}`);
    return { success: true, message: 'Question added successfully!', error: '' };

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, message: '', error: error.errors[0].message };
    }
    return { success: false, message: '', error: error.message || 'Failed to create question.' };
  }
}

export async function toggleQuestionStatusAction(questionId: number, currentStatus: string, categoryId: number) {
  console.log(`[DEBUG] Attempting to toggle question ${questionId} from ${currentStatus}`);

  try {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    // Apelăm baza de date
    const result = await setQuestionStatus(questionId, newStatus as any);
    console.log(`[DEBUG] DB Update Result:`, result);

    // Dacă baza de date a dat eroare, o aruncăm intenționat ca să o vedem
    if (!result.ok) {
      console.error("[DEBUG] Supabase Error:", result.error);
      throw new Error(result.error?.message || "Eroare la baza de date");
    }

    revalidatePath(`/admin/categories/${categoryId}`);
  } catch (error) {
    console.error("[DEBUG] Action Failed:", error);
    // Aruncăm eroarea mai departe
    throw error;
  }
}


export async function editQuestionAction(
  oldQuestionId: number,
  categoryId: number,
  prevState: any,
  formData: FormData
) {
  try {
    const rawAnswers = [];

    for (let i = 0; i < 4; i++) {
      const text = formData.get(`option_text_${i}`);
      const isCorrect = formData.get(`option_correct_${i}`) === 'true';

      if (text) {
        rawAnswers.push({ text: text as string, is_correct: isCorrect });
      }
    }

    const rawData = {
      categoryId: categoryId,
      text: formData.get('text') as string,
      difficulty: formData.get('difficulty') as string,
      answers: rawAnswers
    };

    const validatedData = questionSchema.parse(rawData);

    await setQuestionStatus(oldQuestionId, 'inactive');

    await createQuestion(validatedData as any);

    revalidatePath(`/admin/categories/${categoryId}`);
    return { success: true, message: 'Question updated successfully!', error: '' };

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, message: '', error: error.errors[0].message };
    }
    return { success: false, message: '', error: error.message || 'Failed to update question.' };
  }
}