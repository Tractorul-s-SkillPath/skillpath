'use server';

import { revalidatePath } from 'next/cache';
import { toggleUserStatusService } from '../../../../lib/services/admin.service';

export async function toggleUserStatusAction(userId: number, currentStatus: string) {
  try {
    await toggleUserStatusService(userId, currentStatus);
    revalidatePath('/admin/users');
  } catch (error) {
    console.error('Action error:', error);
    throw new Error('Could not update status');
  }
}