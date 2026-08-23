import { DashboardStats } from '../../../lib/repositories/admin.repo';

export default function OverviewTiles({
  stats,
  weakestCategory
}: {
  stats: DashboardStats,
  weakestCategory: string
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Users</h3>
        <p className="text-3xl font-extrabold text-blue-600 mt-2">{stats.totalUsers}</p>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assessments</h3>
        <p className="text-3xl font-extrabold text-indigo-600 mt-2">{stats.totalAssessments}</p>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Score</h3>
        <p className="text-3xl font-extrabold text-emerald-500 mt-2">{stats.averageScore}%</p>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-red-100 bg-red-50/50 shadow-sm flex flex-col items-center text-center">
        <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider">Weakest Area</h3>
        <p className="text-xl font-extrabold text-red-600 mt-3 truncate w-full px-2" title={weakestCategory}>
          {weakestCategory}
        </p>
      </div>
    </div>
  );
}