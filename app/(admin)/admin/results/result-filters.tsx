/**
 * Results filters.
 *
 * Stories: SP-082, SP-085
 *
 * Sketch: category, level, date range, score range — URL state, same pattern.
 */
export default function ResultFilters({
  currentSearch,
  currentCategory,
  currentSort,
  categories,
}: {
  currentSearch: string;
  currentCategory: string;
  currentSort: string;
  categories: string[];
}) {
  return (
    <div className="p-5 border-b border-slate-200 bg-slate-100 rounded-t-2xl">
      <form className="flex flex-col md:flex-row gap-4 items-center justify-center" method="GET" action="/admin/results">

        <input
          type="text"
          name="search"
          defaultValue={currentSearch}
          placeholder="Search student..."
          className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-full shadow-sm"
        />

        <select name="category" defaultValue={currentCategory} className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white shadow-sm w-full md:w-auto">
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select name="sort" defaultValue={currentSort} className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white shadow-sm w-full md:w-auto">
          <option value="date_desc">Newest First</option>
          <option value="date_asc">Oldest First</option>
          <option value="score_desc">Highest Score</option>
          <option value="score_asc">Lowest Score</option>
        </select>

        <div className="flex gap-3 w-full md:w-auto">
          <button type="submit" className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
            Filter
          </button>
          <a href="/admin/results" className="flex-1 md:flex-none text-center px-6 py-2.5 bg-white border border-gray-300 text-slate-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
            Reset
          </a>
        </div>
      </form>
    </div>
  );
}