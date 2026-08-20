"use client";

/**
 * Global error boundary.
 *
 * Layer: PAGE (client component — error boundaries must be)
 * Story: SP-001 · convention §8: services return Result, only *unexpected*
 * throws reach this file.
 *
 * Sketch
 *  - generic message, a reset() button, digest logged
 *  - never renders error.message to the user: it can carry database detail
 */
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Logăm eroarea în consolă (sau către un serviciu extern),
    // exact cum cere cerința "digest logged"
    console.error("Unexpected global error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Oops! Ceva nu a funcționat conform planului.
      </h2>

      {/* Mesaj generic, fără error.message */}
      <p className="text-gray-500 mb-8 max-w-md">
        A apărut o eroare neașteptată pe server. Te rugăm să încerci din nou sau să revii mai târziu.
      </p>

      {/* Butonul de reset() cerut în Sketch */}
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-sm font-medium"
      >
        Încearcă din nou
      </button>
    </div>
  );
}