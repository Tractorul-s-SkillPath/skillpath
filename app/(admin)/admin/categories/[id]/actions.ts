'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createQuestionService } from '../../../../../lib/services/admin.service';

const questionSchema = z.object({
  text: z.string().min(5, "Question text must be at least 5 characters"),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  options: z.array(z.object({
    text: z.string().min(1, "Option text cannot be empty"),
    is_correct: z.boolean()
  })).length(4, "Exactly 4 options are required"),
});

export async function createQuestionAction(categoryId: number, prevState: any, formData: FormData) {
  try {

    const correctOptionIndex = parseInt(formData.get('correct_option') as string);
    if (isNaN(correctOptionIndex)) throw new Error("You must select a correct answer.");

    const rawOptions = [
      { text: formData.get('option_0') as string, is_correct: correctOptionIndex === 0 },
      { text: formData.get('option_1') as string, is_correct: correctOptionIndex === 1 },
      { text: formData.get('option_2') as string, is_correct: correctOptionIndex === 2 },
      { text: formData.get('option_3') as string, is_correct: correctOptionIndex === 3 },
    ];

    const rawData = {
      text: formData.get('text') as string,
      difficulty: formData.get('difficulty') as string,
      options: rawOptions
    };

    const validatedData = questionSchema.parse(rawData);

    await createQuestionService(categoryId, validatedData.text, validatedData.difficulty, validatedData.options);

    revalidatePath(`/admin/categories/${categoryId}`);
    return { success: true, message: 'Question added successfully!' };

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: error.message || 'Failed to create question.' };
  }
}