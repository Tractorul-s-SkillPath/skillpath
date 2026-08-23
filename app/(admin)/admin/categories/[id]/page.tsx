export const dynamic = 'force-dynamic';

import { getQuestionsByCategoryService, getCategoryByIdService } from '../../../../../lib/services/admin.service';
import QuestionForm from './question-form';
import Link from 'next/link';

export default async function CategoryQuestionsPage({ params }: { params: { id: string } }) {
  // Extragem ID-ul categoriei din URL
  const categoryId = parseInt(params.id, 10);

  // Aducem numele categoriei și întrebările existente
  const [category, questions] = await Promise.all([
    getCategoryByIdService(categoryId),
    getQuestionsByCategoryService(categoryId)
  ]);

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl">

        <header className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              Question Bank: <span className="text-indigo-600">{category.name}</span>
            </h1>
            <p className="text-sm text-slate-500 mt-2">Manage all questions and answers for this specific category.</p>
          </div>
          <Link
            href="/admin/categories"
            className="inline-flex items-center px-5 py-2.5 bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:border-slate-300 hover:bg-slate-100 transition-all shadow-sm"
          >
            &larr; Back to Categories
          </Link>
        </header>

        <div className="flex flex-col lg:flex-row gap-8">

          {/* Formularul de adăugare */}
          <div className="w-full lg:w-1/3">
            <QuestionForm categoryId={categoryId} />
          </div>

          {/* Lista de întrebări existente */}
          <div className="w-full lg:w-2/3 space-y-6">
            {questions.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center text-slate-500 font-medium">
                No questions found for this category. Use the form to add the first one!
              </div>
            ) : (
              questions.map((question, index) => (
                <div key={question.question_id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-start mb-4 gap-4">
                    <h3 className="text-lg font-bold text-slate-800">
                      <span className="text-slate-400 mr-2">Q{questions.length - index}.</span>
                      {question.text}
                    </h3>
                    <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full border ${
                      question.difficulty === 'beginner' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      question.difficulty === 'intermediate' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {question.difficulty}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    {question.options.map((opt: any) => (
                      <div
                        key={opt.answer_id}
                        className={`p-3 rounded-lg text-sm font-medium border ${
                          opt.is_correct
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-800 shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        {opt.is_correct && <span className="mr-2">✓</span>}
                        {opt.answer_text}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    </div>
  );
}