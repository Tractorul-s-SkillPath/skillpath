export const dynamic = 'force-dynamic';

import { getCategoriesListService } from '../../../../lib/services/admin.service';
import { toggleCategoryStatusAction } from './actions';
import CategoryForm from './category-form';
import Link from 'next/link';

export default async function CategoriesPage() {
  const categories = await getCategoriesListService();

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl">

        {/* Header-ul paginii */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Category Catalog</h1>
            <p className="text-sm text-slate-500 mt-2">Manage skill categories available for assessment.</p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center px-5 py-2.5 bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:border-slate-300 hover:bg-slate-100 transition-all shadow-sm"
          >
            &larr; Back to Dashboard
          </Link>
        </header>

        <div className="flex flex-col lg:flex-row gap-8">

          {/* Partea Stângă: Formularul */}
          <div className="w-full lg:w-1/3">
            <CategoryForm />
          </div>

          {/* Partea Dreaptă: Tabelul */}
          <div className="w-full lg:w-2/3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-fit">
            <div className="p-5 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Existing Categories</h2>
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full text-left text-sm border-collapse border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-6 py-4 border border-slate-200 text-center">Name</th>
                    <th className="px-6 py-4 border border-slate-200 text-center">Questions</th>
                    <th className="px-6 py-4 border border-slate-200 text-center">Status</th>
                    <th className="px-6 py-4 border border-slate-200 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        No categories found. Use the form to create one.
                      </td>
                    </tr>
                  ) : (
                    categories.map((cat) => (
                      <tr key={cat.category_id} className="hover:bg-slate-50 transition-colors even:bg-slate-50/50">
                        <td className="px-6 py-4 border border-slate-200">
                          <p className="font-bold text-slate-800">{cat.name}</p>
                          {cat.description && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2" title={cat.description}>
                              {cat.description}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 border border-slate-200 text-center font-medium text-slate-600">
                          {cat.question_count}
                        </td>
                        <td className="px-6 py-4 border border-slate-200 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            cat.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {cat.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 border border-slate-200 text-center">
                          <div className="flex items-center justify-center gap-3">

                            {/* NOUL BUTON PENTRU ÎNTREBĂRI */}
                            <Link
                              href={`/admin/categories/${cat.category_id}`}
                              className="px-4 py-2 rounded-lg text-sm font-bold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 shadow-sm transition-transform hover:scale-105"
                            >
                              Questions
                            </Link>

                            <form action={toggleCategoryStatusAction.bind(null, cat.category_id, cat.status)}>
                              <button
                                type="submit"
                                className={`px-4 py-2 rounded-lg text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 ${
                                  cat.status === 'active'
                                    ? 'bg-orange-500 hover:bg-orange-600'
                                    : 'bg-emerald-500 hover:bg-emerald-600'
                                }`}
                              >
                                {cat.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}