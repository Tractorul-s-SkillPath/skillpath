/**
 * All results.
 *
 * Layer: PAGE
 * Stories: SP-082, SP-085, SP-086
 *
 * Sketch: student, category, score, level, date. Sortable, server-side paged,
 * filter state in the URL. Sorting is an ORDER BY, not an Array.sort on 10k rows.
 */
export const dynamic = 'force-dynamic';

import { getResultsListService, getCategoriesDropdownService } from '../../../../lib/services/admin.service';
import ResultFilters from './result-filters';
import Link from 'next/link';

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: { search?: string; category?: string; sort?: string; page?: string };
}) {
  const params = await searchParams;

  const search = params?.search || '';
  const category = params?.category || '';
  const sort = params?.sort || 'date_desc';
  const currentPage = Number(params?.page) || 1;

  const [resultsData, categories] = await Promise.all([
    getResultsListService(currentPage, search, category, sort),
    getCategoriesDropdownService()
  ]);

  const { data: results, total } = resultsData;
  const totalPages = Math.ceil(total / 10);

  // Helper function to build pagination URLs keeping existing filters
  const buildPageUrl = (pageNumber: number) => {
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (category) query.set('category', category);
    if (sort) query.set('sort', sort);
    query.set('page', pageNumber.toString());
    return `/admin/results?${query.toString()}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl">

        <header className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Assessment Results</h1>
            <p className="text-sm text-slate-500 mt-2">Comprehensive history of all student evaluations.</p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center px-5 py-2.5 bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:border-slate-300 hover:bg-slate-100 transition-all shadow-sm"
          >
            &larr; Back to Dashboard
          </Link>
        </header>

        <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
          <ResultFilters
            currentSearch={search}
            currentCategory={category}
            currentSort={sort}
            categories={categories}
          />

          <div className="overflow-x-auto p-4">
            <table className="w-full text-center text-sm border-collapse border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4 border border-slate-200">Student Name</th>
                  <th className="px-6 py-4 border border-slate-200">Category</th>
                  <th className="px-6 py-4 border border-slate-200">Score</th>
                  <th className="px-6 py-4 border border-slate-200">Level</th>
                  <th className="px-6 py-4 border border-slate-200">Date</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500 text-base">
                      No results found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  results.map((res) => (
                    <tr key={res.assessment_id} className="hover:bg-slate-50 transition-colors even:bg-slate-50/50">
                      <td className="px-6 py-4 border border-slate-200 font-semibold text-slate-800">
                        {res.first_name} {res.last_name}
                        <div className="text-xs text-slate-500 font-normal mt-1">{res.email}</div>
                      </td>
                      <td className="px-6 py-4 border border-slate-200 font-medium text-slate-700">
                        {res.category_name}
                      </td>
                      <td className="px-6 py-4 border border-slate-200">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          res.total_score >= 80 ? 'bg-emerald-100 text-emerald-800' :
                          res.total_score >= 50 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {res.total_score}%
                        </span>
                      </td>
                      <td className="px-6 py-4 border border-slate-200 capitalize text-slate-600 font-medium">
                        {res.level}
                      </td>
                      <td className="px-6 py-4 border border-slate-200 text-slate-500">
                        {new Date(res.created_at).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* SP-082: Server-side Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-sm text-slate-600 font-medium">
                Showing page <span className="font-bold">{currentPage}</span> of <span className="font-bold">{totalPages}</span>
              </span>
              <div className="flex gap-2">
                {currentPage > 1 ? (
                  <Link href={buildPageUrl(currentPage - 1)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-100 shadow-sm text-sm">
                    &larr; Previous
                  </Link>
                ) : (
                  <button disabled className="px-4 py-2 bg-slate-100 border border-slate-200 text-slate-400 font-bold rounded-lg shadow-sm text-sm cursor-not-allowed">
                    &larr; Previous
                  </button>
                )}

                {currentPage < totalPages ? (
                  <Link href={buildPageUrl(currentPage + 1)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-100 shadow-sm text-sm">
                    Next &rarr;
                  </Link>
                ) : (
                  <button disabled className="px-4 py-2 bg-slate-100 border border-slate-200 text-slate-400 font-bold rounded-lg shadow-sm text-sm cursor-not-allowed">
                    Next &rarr;
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}