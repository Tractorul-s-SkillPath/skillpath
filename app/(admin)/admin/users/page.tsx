export const dynamic = 'force-dynamic';

import { getUsersListService } from '../../../../lib/services/admin.service';
import { toggleUserStatusAction } from './actions';
import UserFilters from './user-filters';
import Link from 'next/link';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { search?: string; role?: string; status?: string };
}) {
  const params = await searchParams;
  const search = params?.search || '';
  const role = params?.role || '';
  const status = params?.status || '';

  const users = await getUsersListService(search, role, status);

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">User Management</h1>
            <p className="text-sm text-slate-500 mt-2">View, filter, and manage platform access.</p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center px-5 py-2.5 bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:border-slate-300 hover:bg-slate-100 transition-all shadow-sm"
          >
            &larr; Back to Dashboard
          </Link>
        </header>

        <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
          <UserFilters currentSearch={search} currentRole={role} currentStatus={status} />

          <div className="overflow-x-auto p-4">
            <table className="w-full text-center text-sm border-collapse border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4 border border-slate-200">Full Name</th>
                  <th className="px-6 py-4 border border-slate-200">Email</th>
                  <th className="px-6 py-4 border border-slate-200">Role</th>
                  <th className="px-6 py-4 border border-slate-200">Status</th>
                  <th className="px-6 py-4 border border-slate-200">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500 text-base">
                      No users found. Try clearing your filters.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.user_id} className="hover:bg-slate-50 transition-colors even:bg-slate-50/50">
                      <td className="px-6 py-5 border border-slate-200 font-semibold text-slate-800">
                        {user.first_name} {user.last_name}
                      </td>
                      <td className="px-6 py-5 border border-slate-200 text-slate-600">
                        {user.email}
                      </td>
                      <td className="px-6 py-5 border border-slate-200 capitalize text-slate-600 font-medium">
                        {user.role}
                      </td>
                      <td className="px-6 py-5 border border-slate-200">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          user.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 border border-slate-200">
                        <form action={toggleUserStatusAction.bind(null, user.user_id, user.status)}>
                          <button
                            type="submit"
                            className={`px-4 py-2 rounded-lg text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 ${
                              user.status === 'active'
                                ? 'bg-orange-500 hover:bg-orange-600'
                                : 'bg-emerald-500 hover:bg-emerald-600'
                            }`}
                          >
                            {user.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </form>
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