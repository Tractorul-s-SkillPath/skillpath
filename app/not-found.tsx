/**
 * 404.
 *
 * Story: SP-053 — opening another student's assessment id must land here,
 * because RLS returned zero rows, not because an `if` said so.
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <h2 className="text-2xl font-bold mb-2">404 - Pagina nu a fost găsită</h2>
      <p className="text-gray-500">Ruta pe care o cauți nu există.</p>
    </div>
  );
}