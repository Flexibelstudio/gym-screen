
import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { ExerciseDagsformAdvice, getExerciseDagsformAdvice } from '../services/geminiService';
import { WorkoutLog } from '../types';
import { SparklesIcon, ChartBarIcon, HistoryIcon } from './icons';
import { motion } from 'framer-motion';

interface DailyFormInsightModalProps {
    isOpen: boolean;
    onClose: () => void;
    exerciseName: string;
    feeling: 'good' | 'neutral' | 'bad';
    allLogs: WorkoutLog[];
    onApplySuggestion: (weight: string, advice: string) => void;
}

export const DailyFormInsightModal: React.FC<DailyFormInsightModalProps> = ({ 
    isOpen, onClose, exerciseName, feeling, allLogs, onApplySuggestion 
}) => {
    const [advice, setAdvice] = useState<ExerciseDagsformAdvice | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen && exerciseName) {
            setIsLoading(true);
            getExerciseDagsformAdvice(exerciseName, feeling, allLogs)
                .then(setAdvice)
                .finally(() => setIsLoading(false));
        }
    }, [isOpen, exerciseName, feeling]);

    const handleApply = () => {
        if (advice) {
            // Använd den numeriska vikten från AI:n direkt
            const weight = String(advice.suggestedWeight);
            const reasoning = advice.reasoning;
            onApplySuggestion(weight, reasoning);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Hitta dagsform" size="md">
            <div className="space-y-8 pb-4">
                <div className="text-center">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{exerciseName}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Personlig viktcoach</p>
                </div>

                {isLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-4">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Analyserar historik...</p>
                    </div>
                ) : (
                    <>
                        {/* Historik-sektion */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
                            <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <HistoryIcon className="w-3 h-3" /> Senaste resultaten
                            </h4>
                            <div className="space-y-3">
                                {advice?.history && advice.history.length > 0 ? (
                                    advice.history.map((h, i) => (
                                        <div key={i} className="flex justify-between items-center bg-white dark:bg-gray-900 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{h.date}</span>
                                            <span className="font-mono font-black text-gray-900 dark:text-white">
                                                {h.weight}kg <span className="text-[10px] opacity-40 font-normal">x {h.reps}</span>
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-400 italic text-center py-2">Ingen tidigare historik hittades.</p>
                                )}
                            </div>
                        </div>

                        {/* AI Tips Sektion */}
                        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                                        <SparklesIcon className="w-5 h-5 text-white" />
                                    </div>
                                    <h4 className="font-bold text-indigo-100 uppercase tracking-widest text-[10px]">AI Coach tipsar</h4>
                                </div>

                                <div className="mb-4">
                                    <p className="text-[10px] text-indigo-200 font-bold uppercase mb-1 tracking-widest">Rekommenderad vikt idag</p>
                                    <p className="text-5xl font-black tracking-tighter">{advice?.suggestion}</p>
                                </div>

                                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                                    <p className="text-sm leading-relaxed font-medium italic">
                                        "{advice?.reasoning}"
                                    </p>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={handleApply}
                                className="w-full bg-primary hover:brightness-110 text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all transform active:scale-95 text-lg uppercase tracking-tight"
                            >
                                Använd förslag
                            </button>
                            <button 
                                onClick={onClose}
                                className="w-full bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold py-3 rounded-2xl transition-all"
                            >
                                Stäng
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};
