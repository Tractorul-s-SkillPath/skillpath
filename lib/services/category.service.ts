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
// createServiceClient, NOT createClient: RLS has no admin policy, deliberately.
//
// The policies in *_securitate_rls.sql are all `auth.uid()` = own rows, plus
// read-only SELECT on the content bank. An admin client on the anon key is
// therefore refused every write here — `42501 new row violates row-level
// security policy for table "skill_categories"` was this file creating a
// category through the member's own session.
//
// The fix is not an is_admin() policy. That would put the role check in the
// database AND in assertAdmin(), where the two can drift; ARCHITECTURE §5c puts
// it in one place. EVERY exported function below calls assertAdmin() before it
// touches this client, and that is the whole of the authorization story.
import { createServiceClient } from '../supabase/server';
import * as categoryRepo from '../repositories/category.repo';
import type { ContentStatus } from '../supabase/database.types';
import type { AppError } from '../errors';
import type { Result } from '../result';
import type { CatalogCategory, SkillCategory } from '../domain/types';
import type { CategoryInput } from '../validation/category.schema';

/** The admin catalog: inactive categories included, question counts attached. */
export async function listCategories(): Promise<Result<CatalogCategory[], AppError>> {
    await assertAdmin();
    return categoryRepo.listWithQuestionCounts(createServiceClient());
}

export async function getCategory(categoryId: number): Promise<Result<SkillCategory, AppError>> {
    await assertAdmin();
    return categoryRepo.findById(createServiceClient(), categoryId);
}

export async function createCategory(
    input: CategoryInput,
): Promise<Result<SkillCategory, AppError>> {
    await assertAdmin();
    return categoryRepo.insert(createServiceClient(), input.name, input.description);
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
    return categoryRepo.setStatus(createServiceClient(), categoryId, status);
}
