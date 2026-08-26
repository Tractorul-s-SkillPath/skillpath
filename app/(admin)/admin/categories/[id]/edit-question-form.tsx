'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { editQuestionAction } from './actions';
import Link from 'next/link';

const initialState = { success: false, message: '', error: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="py-2 px-4 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:bg-indigo-400 text-sm transition-colors">
      {pending ? 'Saving...' : 'Save Changes'}
    </button>
  );
}

export default function EditQuestionForm({ question, categoryId }: { question: any, categoryId: number }) {
  const formActionWithArgs = editQuestionAction.bind(null, question.questionId, categoryId);
  const [state, formAction] = useActionState(formActionWithArgs, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const [optionCount, setOptionCount] = useState(question.answers.length > 2 ? question.answers.length : 2);

  const addOption = () => { if (optionCount < 4) setOptionCount(prev => prev + 1); };
  const removeOption = () => { if (optionCount > 2) setOptionCount(prev => prev - 1); };

  useEffect(() => {
    if (state.success) {
        window.location.href = `/admin/categories/${categoryId}`;
    }
  }, [state.success, categoryId]);

  return (
    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
      <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-900">Edit Question</h3>
          <Link href={`/admin/categories/${categoryId}`} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Cancel</Link>
      </div>

      <form ref={formRef} action={formAction} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">Question Text *</label>
          <textarea name="text" required rows={2} defaultValue={question.text} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-900"></textarea>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1">Difficulty *</label>
          <select name="difficulty" required defaultValue={question.difficulty} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-end border-b border-slate-200 pb-2">
            <label className="block text-sm font-semibold text-slate-900">Answers (Check correct ones) *</label>
            <div className="flex gap-2">
              <button type="button" onClick={removeOption} disabled={optionCount <= 2} className="px-3 py-1 text-sm font-bold text-slate-600 bg-slate-200 rounded-lg hover:bg-slate-300 disabled:opacity-50">-</button>
              <button type="button" onClick={addOption} disabled={optionCount >= 4} className="px-3 py-1 text-sm font-bold text-slate-600 bg-slate-200 rounded-lg hover:bg-slate-300 disabled:opacity-50">+</button>
            </div>
          </div>

          {Array.from({ length: optionCount }).map((_, index) => {
            const existingAnswer = question.answers[index];
            return (
              <div key={index} className="flex items-center gap-3">
                <input type="checkbox" name={`option_correct_${index}`} value="true" defaultChecked={existingAnswer?.isCorrect || false} className="w-5 h-5 text-indigo-600 rounded cursor-pointer border-slate-300 focus:ring-indigo-500" />
                <input type="text" name={`option_text_${index}`} required defaultValue={existingAnswer?.text || ''} placeholder={`Option ${index + 1}`} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-900 placeholder-slate-400" />
              </div>
            );
          })}
        </div>

        {state.error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg font-medium">{state.error}</div>}

        <div className="flex justify-end pt-2">
            <SubmitButton />
        </div>
      </form>
    </div>
  );
}