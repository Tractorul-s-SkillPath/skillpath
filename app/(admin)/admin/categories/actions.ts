/**
 * Category actions.
 *
 * Layer: ACTION
 * Stories: SP-031, SP-032
 *
 * Sketch
 *  createCategory / updateCategory
 *   - assertAdmin, categorySchema.safeParse (2-60 chars — the SAME rule the DB
 *     check constraint enforces; Zod for the message, the constraint for the truth)
 *   - a unique violation from Postgres is caught and mapped to a field error.
 *     A 500 on a duplicate name is a bug (SP-031 AC2).
 *
 *  deactivateCategory  -- SP-032: status='inactive'. Hides it from student
 *   pickers, preserves existing assessments. Hard delete is refused by
 *   `on delete restrict`; we never expose one.
 *
 * Test: tests/app/(admin)/admin/categories/actions.test.ts
 */

 'use server';

 import { revalidatePath } from 'next/cache';
 import { z } from 'zod';
 import { createCategoryService, toggleCategoryStatusService } from '../../../../lib/services/admin.service';

 // Schema de validare Zod
 const createCategorySchema = z.object({
   name: z.string().min(2, "Name must be at least 2 characters").max(60, "Name must be under 60 characters"),
   description: z.string().optional(),
 });

 export async function createCategoryAction(prevState: any, formData: FormData) {
   try {
     const rawData = {
       name: formData.get('name') as string,
       description: formData.get('description') as string,
     };

     // Validăm datele
     const validatedData = createCategorySchema.parse(rawData);

     await createCategoryService(validatedData.name, validatedData.description || '');

     revalidatePath('/admin/categories');
     return { success: true, message: 'Category created successfully!' };

   } catch (error: any) {
     if (error instanceof z.ZodError) {
       return { success: false, error: error.errors[0].message };
     }
     return { success: false, error: error.message || 'Failed to create category.' };
   }
 }

 export async function toggleCategoryStatusAction(categoryId: number, currentStatus: string) {
   try {
     await toggleCategoryStatusService(categoryId, currentStatus);
     revalidatePath('/admin/categories');
   } catch (error) {
     console.error('Status toggle error:', error);
   }
 }
