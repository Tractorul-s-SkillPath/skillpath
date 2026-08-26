'use client';

import { useFormStatus } from 'react-dom';
import { useRef, useEffect, useState, useActionState } from 'react';
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
  const [state, formAction] = useActionState(formActionWithId, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [optionCount, setOptionCount] = useState(4);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setOptionCount(4);
    }
  }, [state.success]);

  const addOption = () => { if (optionCount < 4) setOptionCount(prev => prev + 1); };
  const removeOption = () => { if (optionCount > 2) setOptionCount(prev => prev - 1); };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-lg font-bold text-slate-900 mb-4">Create New Question</h2>

      <form ref={formRef} action={formAction} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">Question Text *</label>
          <textarea name="text" required rows={3} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-900"></textarea>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">Difficulty *</label>
          <select name="difficulty" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-end border-b border-slate-200 pb-2">
            <label className="block text-sm font-semibold text-slate-900">Answers (Check correct ones) *</label>
            <div className="flex gap-2">
              <button type="button" onClick={removeOption} disabled={optionCount <= 2} className="px-3 py-1 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50">-</button>
              <button type="button" onClick={addOption} disabled={optionCount >= 4} className="px-3 py-1 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50">+</button>
            </div>
          </div>

          {Array.from({ length: optionCount }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <input type="checkbox" name={`option_correct_${index}`} value="true" className="w-5 h-5 text-indigo-600 rounded cursor-pointer border-slate-300 focus:ring-indigo-500" />
              <input type="text" name={`option_text_${index}`} required placeholder={`Option ${index + 1}`} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-900 placeholder-slate-400" />
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