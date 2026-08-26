'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createCategory, setCategoryStatus } from '../../../../lib/services/category.service';

const categorySchema = z.object({
  name: z.string().min(3, "Category name must be at least 3 characters"),
  description: z.string().optional(),
});

export async function createCategoryAction(prevState: any, formData: FormData) {
  try {
    const rawData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
    };

    const validatedData = categorySchema.parse(rawData);

    await createCategory({
        name: validatedData.name,
        description: validatedData.description
    });

    revalidatePath('/admin/categories');
    return { success: true, message: 'Category created successfully!', error: '' };

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, message: '', error: error.errors[0].message };
    }
    return { success: false, message: '', error: error.message || 'Failed to create category.' };
  }
}

export async function setCategoryStatusAction(categoryId: number, currentStatus: string) {
  try {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await setCategoryStatus(categoryId, newStatus as any);
    
    revalidatePath('/admin/categories');
  } catch (error) {
    console.error("Failed to toggle category status:", error);
    throw new Error('Failed to update status.');
  }
}