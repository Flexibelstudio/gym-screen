
import React, { useState } from 'react';
import { Workout } from '../../types';
import { SparklesIcon } from '../icons';

export const AICoachSidebar: React.FC<{
    workout: Workout;
    onAnalyze: () => Promise<void>;
}> = ({ workout, onAnalyze }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleAnalyzeClick = async () => {
        setIsAnalyzing(true);
        try {
            await onAnalyze();
        } catch (error) {
            console.error("Analysis failed", error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const hasSummary = !!workout.aiCoachSummary;
    const hasSuggestions = workout.blocks?.some(b => 
        (b.aiMagicPenSuggestions && b.aiMagicPenSuggestions.length > 0) || b.aiCoachNotes
    );

    return (
        <div className="sticky top-8 space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <button 
                    onClick={handleAnalyzeClick} 
                    disabled={isAnalyzing}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
                >
                    {isAnalyzing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <SparklesIcon className="w-5 h-5" />
                    )}
                    <span>{isAnalyzing ? 'Analyserar...' : 'Analysera passet'}</span>
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                    Klicka här för att få feedback på dina ändringar utan att AI:n byter ut dina övningar.
                </p>
            </div>

            {/* AI Summary */}
            {hasSummary && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 rounded-xl p-6 shadow-sm border border-purple-100 dark:border-gray-700 relative overflow-hidden">
                    <h3 className="text-lg font-bold text-purple-900 dark:text-white mb-3 flex items-center gap-2">
                        <span className="text-2xl">🤖</span>
                        <span>AI-Coach Summering</span>
                    </h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {workout.aiCoachSummary}
                    </p>
                </div>
            )}

            {/* Block Suggestions */}
            {hasSuggestions && (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-xl p-6 shadow-sm border border-yellow-200 dark:border-yellow-900/30">
                    <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-200 mb-4 flex items-center gap-2">
                        <span className="text-2xl">✨</span>
                        <span>Tips & Förbättringar</span>
                    </h3>
                    <div className="space-y-6">
                        {workout.blocks.map(block => {
                            const hasNotes = !!block.aiCoachNotes;
                            const hasMagic = block.aiMagicPenSuggestions && block.aiMagicPenSuggestions.length > 0;
                            
                            if (!hasNotes && !hasMagic) return null;

                            return (
                                <div key={block.id} className="space-y-2">
                                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm border-b border-yellow-200 dark:border-yellow-800 pb-1">
                                        {block.title}
                                    </h4>
                                    
                                    {/* Coach Notes (Analysis) */}
                                    {hasNotes && (
                                        <div className="p-2 bg-white/50 dark:bg-black/20 rounded-md">
                                            <p className="text-xs text-gray-700 dark:text-gray-300 italic">"{block.aiCoachNotes}"</p>
                                        </div>
                                    )}

                                    {/* Magic Pen Suggestions (Actionable) */}
                                    {hasMagic && (
                                        <ul className="space-y-1.5 pt-1">
                                            {block.aiMagicPenSuggestions!.map((sugg, i) => (
                                                <li key={i} className="flex items-start gap-2 text-xs text-gray-800 dark:text-gray-200">
                                                    <span className="text-yellow-600 dark:text-yellow-400 mt-0.5 font-bold">→</span>
                                                    <span>{sugg}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {!hasSummary && !hasSuggestions && !isAnalyzing && (
                <div className="text-center p-8 bg-slate-100 dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 border-dashed">
                    <p className="text-gray-500 dark:text-gray-400">Klicka på "Analysera passet" för att få feedback.</p>
                </div>
            )}
        </div>
    );
};