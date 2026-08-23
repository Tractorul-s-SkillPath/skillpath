export default function UserFilters({
  currentSearch,
  currentRole,
  currentStatus,
}: {
  currentSearch: string;
  currentRole: string;
  currentStatus: string;
}) {
  return (
    <div className="p-5 border-b border-gray-200 bg-slate-100 rounded-t-2xl">
      <form className="flex flex-col md:flex-row gap-4 items-center justify-center" method="GET" action="/admin/users">
        <input
          type="text"
          name="search"
          defaultValue={currentSearch}
          placeholder="Search name or email..."
          className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-auto shadow-sm"
        />
        <select name="role" defaultValue={currentRole} className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white shadow-sm w-full md:w-auto">
          <option value="">All Roles</option>
          <option value="student">Student</option>
          <option value="admin">Admin</option>
        </select>
        <select name="status" defaultValue={currentStatus} className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white shadow-sm w-full md:w-auto">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <div className="flex gap-3 w-full md:w-auto">
          <button type="submit" className="flex-1 md:flex-none px-6 py-2.5 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-900 transition-colors shadow-sm">
            Apply
          </button>
          <a href="/admin/users" className="flex-1 md:flex-none text-center px-6 py-2.5 bg-white border border-gray-300 text-slate-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
            Reset
          </a>
        </div>
      </form>
    </div>
  );
}