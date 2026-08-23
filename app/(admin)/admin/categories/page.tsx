/**
 * Category catalog.
 *
 * Layer: PAGE
 * Stories: SP-030, SP-031, SP-032
 *
 * The create form sits beside the list, so adding a category and seeing it
 * appear is one screen rather than two.
 *
 * Inactive categories are listed, not hidden: this is the screen where you
 * would come to turn one back on. The student picker is the one that filters
 * them out.
 */

import Link from 'next/link';
import { listCategories } from '../../../../lib/services/category.service';
import { unwrapOr } from '../../../../lib/result';
import { setCategoryStatusAction } from './actions';
import { CategoryForm } from './category-form';
import { StatusToggle } from '../status-toggle';
import { Section } from '../../../../components/ui/card';
import { Chip } from '../../../../components/ui/chip';
import { buttonClass } from '../../../../components/ui/button';
import { EmptyState } from '../../../../components/empty-state';

export const metadata = { title: 'Categories · SkillPath admin' };

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
    const categories = unwrapOr(await listCategories(), []);

    return (
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 lg:py-10">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">Categories</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        The skills members can be assessed in.
                    </p>
                </div>

                <Link href="/admin" className={buttonClass('ghost', 'sm')}>
                    ← Overview
                </Link>
            </header>

            <div className="grid gap-5 lg:grid-cols-[20rem_1fr] lg:items-start">
                <Section title="New category" description="Names are unique and cannot be reused.">
                    <CategoryForm />
                </Section>

                <Section
                    title="Catalog"
                    description="Deactivating hides a category from the student picker; existing assessments keep it."
                >
                    {categories.length === 0 ? (
                        <EmptyState
                            title="No categories yet"
                            description="Add the first one with the form beside this list — members cannot be assessed until at least one exists."
                        />
                    ) : (
                        <ul className="divide-y divide-[color:var(--border)]">
                            {categories.map((category) => (
                                <li
                                    key={category.categoryId}
                                    className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-medium text-foreground">{category.name}</p>
                                            <Chip tone={category.status === 'active' ? 'success' : 'danger'}>
                                                {category.status}
                                            </Chip>
                                            <Chip>
                                                {category.questionCount}
                                                {category.questionCount === 1 ? ' question' : ' questions'}
                                            </Chip>
                                        </div>

                                        {category.description ? (
                                            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                                                {category.description}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="flex items-start gap-2">
                                        <Link
                                            href={`/admin/categories/${category.categoryId}`}
                                            className={buttonClass('secondary', 'sm')}
                                        >
                                            Questions
                                        </Link>

                                        <StatusToggle
                                            action={setCategoryStatusAction}
                                            fields={{ categoryId: category.categoryId }}
                                            target={category.status === 'active' ? 'inactive' : 'active'}
                                            label={category.status === 'active' ? 'Deactivate' : 'Activate'}
                                            describedAs={category.name}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Section>
            </div>
        </div>
    );
}
