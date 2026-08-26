'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createQuestionService } from '../../../../lib/services/admin.service';

const questionSchema = z.object({
  text: z.string().min(5, "Question text must be at least 5 characters"),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  options: z.array(z.object({
    text: z.string().min(1, "Option text cannot be empty"),
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
    const rawOptions = [];
    
    for (let i = 0; i < 4; i++) {
      const text = formData.get(`option_text_${i}`);
      const isCorrect = formData.get(`option_correct_${i}`) === 'true';
      
      if (text) {
        rawOptions.push({ text: text as string, is_correct: isCorrect });
      }
    }

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