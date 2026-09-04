'use client';

import { useState, useEffect } from 'react';
import { getAIFeedbackAction } from './actions';

interface AIFeedbackBoxProps {
    assessmentId: string;
    score: number;
    weakAreas: string[];
}

export function AIFeedbackBox({ assessmentId, score, weakAreas }: AIFeedbackBoxProps) {
    const [feedback, setFeedback] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [loadingStep, setLoadingStep] = useState<number>(0);

    useEffect(() => {
        let isMounted = true;

        async function fetchFeedback() {
            setLoading(true);
            setLoadingStep(0);

            const timer1 = setTimeout(() => {
                if (isMounted) setLoadingStep(1);
            }, 1000);

            try {
                const [res] = await Promise.all([
                    getAIFeedbackAction(assessmentId, score, weakAreas),
                    new Promise((resolve) => setTimeout(resolve, 2200))
                ]);

                if (isMounted) {
                    if (res.success) {
                        setFeedback(res.feedback);
                    } else {
                        setFeedback(res.feedback);
                    }
                }
            } catch (error) {
                if (isMounted) {
                    setFeedback("Could not load AI insights at the moment.");
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        fetchFeedback();

        return () => {
            isMounted = false;
        };
    }, [assessmentId, score, weakAreas]);

    const loadingTexts = [
        "Analyzing assessment performance & weak areas...",
        "Crafting personalized motivational insights & tips..."
    ];

    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 backdrop-blur-sm transition-all shadow-lg">
            <div className="flex items-center gap-3 mb-3">
                <span className="text-xl">🤖</span>
                <h3 className="font-semibold text-zinc-200">AI Feedback Assistant</h3>
            </div>

            {loading ? (
                <div className="flex items-center gap-3 py-4 text-zinc-400 transition-opacity duration-300">
                    <svg
                        className="w-5 h-5 animate-spin text-indigo-400 shrink-0"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        ></circle>
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                    </svg>
                    <span className="text-sm font-medium tracking-wide">
                        {loadingTexts[loadingStep]}
                    </span>
                </div>
            ) : (
                <p className="text-sm text-zinc-300 leading-relaxed animate-fadeIn">
                    {feedback}
                </p>
            )}
        </div>
    );
}