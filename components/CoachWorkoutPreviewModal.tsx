import React, { useState } from 'react';
import { Workout } from '../types';

interface CoachWorkoutPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    workouts: Workout[];
    onPreviewWorkout: (workout: Workout) => void;
}

export const CoachWorkoutPreviewModal: React.FC<CoachWorkoutPreviewModalProps> = ({
    isOpen,
    onClose,
    workouts,
    onPreviewWorkout
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    if (!isOpen) return null;

    // We only show official workouts
    const officialWorkouts = workouts.filter(w => !w.isMemberDraft);

    const filteredWorkouts = officialWorkouts.filter(w => {
        const searchLower = searchTerm.toLowerCase();
        return (
            (w.title || '').toLowerCase().includes(searchLower) ||
            (w.category || '').toLowerCase().includes(searchLower)
        );
    });

    return (
        <div className="fixed inset-0 z-[1000] flex flex-col bg-white dark:bg-gray-900 animate-fade-in-up">
            <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 p-4">
                <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
                    <button 
                        onClick={onClose}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <span className="font-bold text-xl">✕</span>
                    </button>
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder="Sök pass eller kategori..."
                            className="w-full bg-gray-100 dark:bg-gray-800 border-transparent focus:bg-white dark:focus:bg-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl px-4 py-3 outline-none transition-all placeholder-gray-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
                <div className="max-w-2xl mx-auto p-4 md:p-6 pb-24">
                    <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Tillgängliga pass</h2>
                    <ul className="space-y-3">
                        {filteredWorkouts.length > 0 ? (
                            filteredWorkouts.map(workout => (
                                <li key={workout.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 flex items-center justify-between border border-gray-100 dark:border-gray-800">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">{workout.title}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs font-semibold text-gray-500 bg-white dark:bg-gray-800 px-2 py-1 rounded truncate shadow-sm border border-gray-100 dark:border-gray-700">
                                                {workout.category || 'Okategoriserad'}
                                            </span>
                                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                                                workout.isPublished 
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' 
                                                : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                            }`}>
                                                {workout.isPublished ? 'Publicerad' : 'Utkast'}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={() => onPreviewWorkout(workout)}
                                        className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-white dark:bg-gray-800 hover:text-primary hover:bg-primary/10 transition-colors shadow-sm border border-gray-100 dark:border-gray-700 active:scale-95 text-gray-400"
                                        title="Förhandsgranska pass"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    </button>
                                </li>
                            ))
                        ) : (
                            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                                {searchTerm ? 'Inga pass matchade din sökning.' : 'Inga pass finns tillgängliga.'}
                            </div>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
};
