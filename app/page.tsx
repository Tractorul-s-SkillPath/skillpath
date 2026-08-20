import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight mb-4">SkillPath</h1>
      <p className="text-gray-500 mb-8">In work...</p>

      <Link
        href="/admin"
        className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
      >
        Go To Admin Dashboard
      </Link>
    </div>
  );
}