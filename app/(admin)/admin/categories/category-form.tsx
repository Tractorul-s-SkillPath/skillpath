/**
 * Create / edit a category.
 *
 * Story: SP-031
 *
 * Sketch: name (2-60 chars, unique), description, status. The uniqueness error
 * comes back from the action as a FIELD error on name (SP-031 AC2).
 */
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useRef, useEffect } from 'react';
import { createCategoryAction } from './actions';

const initialState = { success: false, message: '', error: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full py-2.5 px-4 mt-2 rounded-lg text-white font-bold shadow-sm transition-all ${
        pending ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
      }`}
    >
      {pending ? 'Saving...' : 'Add Category'}
    </button>
  );
}

export default function CategoryForm() {
  const [state, formAction] = useFormState(createCategoryAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Curățăm formularul dacă a fost trimis cu succes
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-lg font-bold text-slate-800 mb-4">Create New Category</h2>

      <form ref={formRef} action={formAction} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1">
            Category Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            placeholder="e.g. JavaScript Basics"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-semibold text-slate-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="Short description about this category..."
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
          ></textarea>
        </div>

        {/* Afișarea mesajelor de eroare sau succes */}
        {state.error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg font-medium">
            {state.error}
          </div>
        )}
        {state.success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm rounded-lg font-medium">
            {state.message}
          </div>
        )}

        <SubmitButton />
      </form>
    </div>
  );
}