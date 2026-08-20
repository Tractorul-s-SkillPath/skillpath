import { getStudentsListService } from '../../../lib/services/admin.service';

export default async function AdminDashboardPage() {
  const students = await getStudentsListService();

  return (
    <div className="min-h-screen bg-gray-50/50 p-8">
      <div className="max-w-7xl mx-auto">

        {/* Page Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Overview of all registered students and their current platform status.
          </p>
        </header>

        {/* Data Table Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">

              {/* Table Header (Always Visible) */}
              <thead className="bg-gray-100/50 text-gray-600 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Full Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Registration Date</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-gray-100">
                {students.length === 0 ? (

                  /* Empty State Row */
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        {/* Users Icon */}
                        <svg className="w-12 h-12 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <p className="text-base font-medium text-gray-900">
                          No students found
                        </p>
                        <p className="text-sm mt-1">
                          There are currently no students registered in the database.
                        </p>
                      </div>
                    </td>
                  </tr>

                ) : (

                  /* Populated Rows */
                  students.map((student) => (
                    <tr key={student.user_id} className="hover:bg-gray-50/80 transition-colors duration-150">
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">
                          {student.first_name} {student.last_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {student.email}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(student.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                            student.status === 'active'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {/* Green/Red dot indicator */}
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${student.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          {student.status === 'active' ? 'Active' : 'Inactive'}
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