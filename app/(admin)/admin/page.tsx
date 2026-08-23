export const dynamic = 'force-dynamic';

import { getDashboardStatsService, getWeakCategoriesService } from '../../../lib/services/admin.service';
import OverviewTiles from './overview-tiles';
import Link from 'next/link';

export default async function AdminDashboardPage() {
  const [stats, weakCategories] = await Promise.all([
    getDashboardStatsService(),
    getWeakCategoriesService()
  ]);

  // Handle case when no assessments exist yet
  const weakestCategoryName = weakCategories.length > 0 ? weakCategories[0].category_name : 'N/A';

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl">

        {/* Header cu Butoanele de Navigare */}
        <header className="mb-10 text-center flex flex-col items-center">
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">Admin Dashboard</h1>
          <p className="text-base text-slate-500 mt-3 mb-6">Platform activity and performance metrics.</p>

          {/* Containerul cu TOATE cele 3 butoane */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
            <Link
              href="/admin/users"
              className="inline-block px-8 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-900 font-semibold shadow-md transition-colors"
            >
              Manage Users &rarr;
            </Link>

            {/* NOUL BUTON PENTRU CATEGORII */}
            <Link
              href="/admin/categories"
              className="inline-block px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold shadow-md transition-colors"
            >
              Manage Categories &rarr;
            </Link>

            <Link
              href="/admin/results"
              className="inline-block px-8 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl hover:border-slate-300 hover:bg-slate-100 font-semibold shadow-sm transition-colors"
            >
              View All Results &rarr;
            </Link>
          </div>
        </header>

        {/* SP-080: Statistics Tiles */}
        <OverviewTiles stats={stats} weakestCategory={weakestCategoryName} />

        {/* SP-081: Aggregated Weak Categories Chart/Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800">Areas Requiring Attention</h2>
            <p className="text-sm text-slate-500 mt-1">Categories ranked from lowest average score to highest across all students.</p>
          </div>

          <div className="p-4">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="text-slate-500 font-bold uppercase tracking-wider text-xs border-b border-slate-100">
                <tr>
                  <th className="pb-3 px-4">Rank</th>
                  <th className="pb-3 px-4">Category Name</th>
                  <th className="pb-3 px-4 text-center">Total Assessments</th>
                  <th className="pb-3 px-4 text-right">Average Score</th>
                </tr>
              </thead>
              <tbody>
                {weakCategories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-500">No assessment data available yet.</td>
                  </tr>
                ) : (
                  weakCategories.map((category, index) => (
                    <tr key={category.category_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 font-medium text-slate-400">#{index + 1}</td>
                      <td className="py-4 px-4 font-bold text-slate-700">{category.category_name}</td>
                      <td className="py-4 px-4 text-center text-slate-600">{category.assessments_count}</td>
                      <td className="py-4 px-4 text-right">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md font-bold ${
                          category.average_score < 50 ? 'bg-red-100 text-red-700' :
                          category.average_score < 75 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {category.average_score}%
                        </span>
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
  );
}