import { getUsersListRepo, getDashboardStatsRepo, updateUserStatusRepo } from '../repositories/admin.repo';

export async function getUsersListService(search?: string, role?: string, status?: string) {
  return await getUsersListRepo(search, role, status);
}

export async function getDashboardStatsService() {
  return await getDashboardStatsRepo();
}

export async function toggleUserStatusService(userId: number, currentStatus: string) {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  await updateUserStatusRepo(userId, newStatus);
}

import { getWeakCategoriesRepo } from '../repositories/admin.repo';

export async function getWeakCategoriesService() {
  return await getWeakCategoriesRepo();
}

import { getResultsListRepo, getCategoriesDropdownRepo } from '../repositories/admin.repo';

export async function getResultsListService(page?: number, search?: string, category?: string, sortBy?: string) {
  return await getResultsListRepo(page, search, category, sortBy);
}

export async function getCategoriesDropdownService() {
  return await getCategoriesDropdownRepo();
}

import { getCategoriesListRepo, createCategoryRepo, toggleCategoryStatusRepo } from '../repositories/admin.repo';

export async function getCategoriesListService() {
  return await getCategoriesListRepo();
}

export async function createCategoryService(name: string, description: string) {
  return await createCategoryRepo(name, description);
}

export async function toggleCategoryStatusService(categoryId: number, currentStatus: string) {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  await toggleCategoryStatusRepo(categoryId, newStatus);
}

import { getQuestionsByCategoryRepo, createQuestionRepo, getCategoryByIdRepo } from '../repositories/admin.repo';

export async function getQuestionsByCategoryService(categoryId: number) {
  return await getQuestionsByCategoryRepo(categoryId);
}

export async function getCategoryByIdService(categoryId: number) {
  return await getCategoryByIdRepo(categoryId);
}

export async function createQuestionService(categoryId: number, text: string, difficulty: string, options: any[]) {
  return await createQuestionRepo(categoryId, text, difficulty, options);
}