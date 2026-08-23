'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useRef, useEffect } from 'react';
import { createQuestionAction } from './actions';

const initialState = { success: false, message: '', error: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full py-2.5 px-4 mt-4 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors">
      {pending ? 'Saving...' : 'Add Question'}
    </button>
  );
}

export default function QuestionForm({ categoryId }: { categoryId: number }) {
  const formActionWithId = createQuestionAction.bind(null, categoryId);
  const [state, formAction] = useFormState(formActionWithId, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-lg font-bold text-slate-800 mb-4">Create New Question</h2>

      <form ref={formRef} action={formAction} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Question Text *</label>
          <textarea name="text" required rows={3} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"></textarea>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Difficulty *</label>
          <select name="difficulty" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div className="space-y-3 pt-2">
          <label className="block text-sm font-semibold text-slate-700 border-b pb-2">Answers (Select the correct one) *</label>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="flex items-center gap-3">
              <input type="radio" name="correct_option" value={index} required className="w-5 h-5 text-indigo-600 cursor-pointer" />
              <input type="text" name={`option_${index}`} required placeholder={`Option ${index + 1}`} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
            </div>
          ))}
        </div>

        {state.error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg font-medium">{state.error}</div>}
        {state.success && <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-lg font-medium">{state.message}</div>}

        <SubmitButton />
      </form>
    </div>
  );
}