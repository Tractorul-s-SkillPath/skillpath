/**
 * Skill category catalog.
 *
 * Layer: SERVICE
 * Stories: SP-030, SP-031, SP-032, SP-040
 *
 * listSelectableCategories(userId) — the student picker, active AND holding
 * enough eligible questions — is not here yet. It belongs to the assessment
 * slice and needs question.repo.pickEligible, which is also unwritten. Adding a
 * half version now would give the picker a second definition of "a category you
 * can be assessed in".
 *
 * Test: tests/lib/services/category.service.test.ts
 */

import 'server-only';
import { assertAdmin } from '../auth/assertAdmin';
import { createClient } from '../supabase/server';
import * as categoryRepo from '../repositories/category.repo';
import type { ContentStatus } from '../supabase/database.types';
import type { AppError } from '../errors';
import type { Result } from '../result';
import type { CatalogCategory, SkillCategory } from '../domain/types';
import type { CategoryInput } from '../validation/category.schema';

/** The admin catalog: inactive categories included, question counts attached. */
export async function listCategories(): Promise<Result<CatalogCategory[], AppError>> {
    await assertAdmin();
    return categoryRepo.listWithQuestionCounts(await createClient());
}

export async function getCategory(categoryId: number): Promise<Result<SkillCategory, AppError>> {
    await assertAdmin();
    return categoryRepo.findById(await createClient(), categoryId);
}

export async function createCategory(
    input: CategoryInput,
): Promise<Result<SkillCategory, AppError>> {
    await assertAdmin();
    return categoryRepo.insert(await createClient(), input.name, input.description);
}

/**
 * Activate or deactivate. There is no delete, by design (SP-032): a category
 * that questions and assessments point at cannot be removed without taking
 * their history with it.
 */
export async function setCategoryStatus(
    categoryId: number,
    status: ContentStatus,
): Promise<Result<void, AppError>> {
    await assertAdmin();
    return categoryRepo.setStatus(await createClient(), categoryId, status);
}
